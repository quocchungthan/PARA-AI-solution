using System.Collections.Concurrent;
using GitHub.Copilot;
using GitHub.Copilot.Rpc;

namespace Bridge;

// Only the scan loop writes Bridge state. Background turns persist their outcomes in the inbox.
public partial class Scanner
{
    readonly string _sessions, _inbox, _statePath, _root;
    readonly string? _model;
    readonly IAgentRuntime? _runtime;
    readonly Func<DateTimeOffset> _now;
    readonly Func<string, DateTimeOffset?> _lastActivity;
    readonly Func<string, bool> _isLive;
    readonly bool _trackSdkOwners;
    readonly ConcurrentDictionary<int, byte> _sdkOwners = new();
    readonly int _dailyHour;
    readonly int _maxDepth = int.TryParse(Environment.GetEnvironmentVariable("PARA_MAX_DEPTH"), out var md) && md > 0 ? md : 3;
    readonly int _maxHandoffs = int.TryParse(Environment.GetEnvironmentVariable("PARA_MAX_HANDOFFS"), out var mh) && mh > 0 ? mh : 5;
    readonly ConcurrentDictionary<string, Task> _turns = new(StringComparer.OrdinalIgnoreCase);
    int _pass;

    public Scanner(string dataDir, string repoRoot, string? model, int dailyHour, IAgentRuntime? runtime,
        Func<DateTimeOffset>? now = null, Func<string, DateTimeOffset?>? lastActivity = null,
        Func<string, bool>? isLive = null)
    {
        _root = repoRoot;
        _model = model;
        _runtime = runtime;
        _dailyHour = dailyHour;
        _now = now ?? (() => DateTimeOffset.UtcNow);
        _lastActivity = lastActivity ?? Inspector.LastActivity;
        _trackSdkOwners = isLive is null;
        _isLive = isLive ?? (id => SessionStore.LiveOwnerIds(id).Any(pid => !_sdkOwners.ContainsKey(pid)));
        _sessions = Path.Combine(dataDir, "sessions");
        _inbox = Path.Combine(dataDir, "inbox");
        _statePath = Path.Combine(dataDir, "bridge", "state.json");
        Directory.CreateDirectory(_sessions);
        Directory.CreateDirectory(_inbox);
        Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
    }

    string Now() => _now().ToString("o");
    string InboxPath(string id) => Path.Combine(_inbox, id + ".json");
    static string MessageId(string kind, string key) => kind + ":" + key;
    static bool Terminal(SessionFile s) => s.State is "done" or "waiting_input" or "blocked" or "needs_human";

#pragma warning disable GHCP001
    static AutopilotOptions BridgeAutopilotOptions() => new()
    {
        ContinuationEnabled = true,
        MaxContinues = 5,
    };
#pragma warning restore GHCP001

    SessionFile? LoadSession(string id)
    {
        var path = Path.Combine(_sessions, id + ".json");
        return File.Exists(path) ? Json.Read<SessionFile>(path) : null;
    }

    InboxMessage? Message(string id, string messageId)
    {
        var path = InboxPath(id);
        return File.Exists(path)
            ? (Json.Read<InboxFile>(path) ?? throw new IOException($"Unreadable inbox: {path}")).Messages.FirstOrDefault(m => m.Id == messageId)
            : null;
    }

    Task QueueAsync(string id, string messageId, string prompt, string from = "bridge",
        bool createSession = false, string? agent = null, int timeoutSeconds = 1800) =>
        InboxStore.EnqueueIfAbsentAsync(InboxPath(id), new InboxMessage
        {
            Id = messageId, From = from, Prompt = prompt, CreatedAt = Now(),
            CreateSession = createSession, Agent = agent, TimeoutSeconds = timeoutSeconds,
        });

    void Save(BridgeState state) => Json.WriteAtomic(_statePath, state);

    static int DepthOf(BridgeState state, string id, HashSet<string>? visited = null)
    {
        visited ??= new(StringComparer.OrdinalIgnoreCase);
        if (!visited.Add(id)) return int.MaxValue / 2;
        var parents = state.Delegations.Where(d => d.Mode != "self" && string.Equals(d.TargetId, id, StringComparison.OrdinalIgnoreCase) && d.Status != "limit_reached").ToList();
        return parents.Count == 0 ? 0 : 1 + parents.Max(d => DepthOf(state, d.OriginId, new(visited, StringComparer.OrdinalIgnoreCase)));
    }

    static bool IsAncestor(BridgeState state, string target, string origin)
    {
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var pending = new Stack<string>();
        pending.Push(origin);
        while (pending.TryPop(out var id))
        {
            if (string.Equals(id, target, StringComparison.OrdinalIgnoreCase)) return true;
            if (!visited.Add(id)) continue;
            foreach (var d in state.Delegations.Where(d => d.Mode != "self" && d.Status != "limit_reached" &&
                string.Equals(d.TargetId, id, StringComparison.OrdinalIgnoreCase)))
                pending.Push(d.OriginId);
        }
        return false;
    }

    public async Task RunOnceAsync()
    {
        Log.Info("scan", $"pass #{++_pass} start");
        var state = File.Exists(_statePath)
            ? Json.Read<BridgeState>(_statePath) ?? throw new IOException($"Bridge state is unreadable; refusing to replace {_statePath}.")
            : new BridgeState();
        var sessions = SessionStore.LoadAll(Path.GetDirectoryName(_sessions)!, _root);
        await ProcessAssignmentsAsync(state, sessions);
        foreach (var s in sessions.Where(s => !s.Discovered && s.Handoff is { Id.Length: > 0, Prompt.Length: > 0 }))
        {
            var h = s.Handoff!;
            var key = s.SessionId + ":" + h.Id;
            var existing = state.Delegations.FirstOrDefault(d => d.Key == key);
            if (existing is not null)
            {
                existing.Prompt ??= h.Prompt;
                existing.Agent ??= h.Agent;
                existing.CreateSession ??= string.Equals(h.Target, "new", StringComparison.OrdinalIgnoreCase);
                continue;
            }
            // Historical completed sessions may retain old handoffs; do not restart their work.
            if (s.State == "done" || s.State == "needs_human" || s.Needs.Any(n => n.Resolver == "human")) continue;
            if (state.SeenHandoffs.Contains(key))
            {
                Log.Warn("handoff", $"{key} has no delegation record; refusing to replay previously seen work");
                continue;
            }
            var create = string.Equals(h.Target, "new", StringComparison.OrdinalIgnoreCase);
            var d = new Delegation
            {
                Key = key, OriginId = s.SessionId, TargetId = create ? Guid.NewGuid().ToString() : h.Target,
                WantResult = h.WantResult, Agent = h.Agent, CreateSession = create,
                Prompt = h.Prompt, CreatedAt = Now(), Status = "pending",
            };
            var limit = DepthOf(state, s.SessionId) >= _maxDepth ||
                state.Delegations.Count(x => x.Protocol != 2 && x.OriginId == s.SessionId) >= _maxHandoffs ||
                !Guid.TryParse(d.TargetId, out _) || IsAncestor(state, d.TargetId, s.SessionId);
            if (limit)
            {
                d.Status = "limit_reached";
                d.LastError = "Invalid target, delegation cycle, depth or handoff limit reached.";
            }
            state.SeenHandoffs.Add(key);
            state.Delegations.Add(d);
            Save(state); // Persist identity and original prompt before any runtime side effect.
        }

        foreach (var d in state.Delegations.Where(d => d.Protocol != 2))
        {
            if (d.Status is "failed" or "limit_reached")
            {
                if (LoadSession(d.OriginId)?.State != "done")
                    await QueueAsync(d.OriginId, MessageId("failure", d.Key),
                        $"BREAKPOINT: delegation {d.Key} cannot continue: {d.LastError}. Do not repeat the handoff. Set needs_human with the error and one precise question, and stop.");
                continue;
            }
            if (d.Status == "result_fed") continue;
            // A delivered result is authoritative even if the target has since started other work.
            var forwarded = Message(d.OriginId, MessageId("result", d.Key));
            if (forwarded?.Status == "delivered") { d.Status = "result_fed"; continue; }
            if (forwarded?.Status == "failed") { Fail(d, $"Result delivery failed: {forwarded.LastError}"); continue; }
            if (forwarded is not null) continue;
            var initialId = MessageId("handoff", d.Key);
            var initial = Message(d.TargetId, initialId);
            d.Attempts = initial?.Attempts ?? d.Attempts;
            if (d.RecoveryAttempts == 0) d.NextAttemptAt = initial?.NextAttemptAt;
            d.LastError = initial?.LastError ?? d.LastError;
            if (initial is { Status: "failed", Attempts: >= RetryPolicy.MaxAttempts })
            {
                Fail(d, initial.LastError ?? "Initial delivery exhausted retry budget.");
                continue;
            }
            if (d.Status == "pending" || d.Status == "starting" && initial is not { Status: "delivered" })
            {
                if (d.Status == "pending" && state.Delegations.Any(x =>
                    AssignmentPolicy.Holds(x) && !AssignmentPolicy.Suspended(x, state, _turns.ContainsKey)))
                    continue; // Unknown legacy write scope is repository-exclusive.
                if (string.IsNullOrWhiteSpace(d.Prompt) || d.CreateSession is null)
                {
                    Fail(d, "Original handoff is unavailable; cannot safely reconstruct this work.");
                    continue;
                }
                await QueueAsync(d.TargetId, initialId, DelegationPrompt(d), d.OriginId, d.CreateSession.Value, d.Agent);
                d.Status = "starting";
                continue;
            }
            d.Status = "assigned";
            if (initial is not null && initial.Status != "delivered") continue;
            var target = LoadSession(d.TargetId);
            if (_turns.ContainsKey(d.TargetId)) continue;
            // A child supervisor waiting on v2 children is not a completed legacy result.
            if (state.Delegations.Any(child => child.Protocol == 2 && child.OriginId == d.TargetId &&
                !AssignmentPolicy.Closed(child))) continue;
            var refreshed = initial is null || DateTimeOffset.TryParse(target?.UpdatedAt, out var updated) &&
                DateTimeOffset.TryParse(initial.LastAttemptAt, out var sent) && updated >= sent;
            if (target is not null && Terminal(target) && refreshed)
            {
                if (SessionHealth.Issues(target).Count > 0)
                {
                    await RecoverAsync(d, "Your session file violates the protocol; repair it before reporting a result.");
                    continue;
                }
                if (!d.WantResult) { d.Status = "result_fed"; continue; }
                var resultId = MessageId("result", d.Key);
                await QueueAsync(d.OriginId, resultId,
                    $"Result of delegation to session {d.TargetId} (state: {target.State}).\nResult: {target.Result}\nQuestion: {target.Question}\nNeeds: {string.Join("; ", target.Needs.Select(n => $"[{n.Resolver}] {n.Text}"))}");
                var result = Message(d.OriginId, resultId)!;
                if (result.Status == "delivered") d.Status = "result_fed";
                else if (result.Status == "failed")
                {
                    Fail(d, $"Result delivery failed: {result.LastError}");
                }
                continue;
            }
            var activity = _lastActivity(d.TargetId);
            if (activity is { } at && _now() - at < Inspector.SilentAfter) continue;
            if (_runtime is not null)
                await RecoverAsync(d, "Re-read your session file and continue interrupted work. Check completed side effects before doing anything again.");
        }
        Save(state);
        await DailyScrumAsync(state, sessions);
        Save(state);
        WriteHumanQueue(sessions, state);
        if (_runtime is not null)
            await DispatchAsync(state);
        else
            Log.Warn("scan", "No Copilot runtime; queued work is retained without consuming retry attempts.");
        Log.Info("scan", $"pass #{_pass} done: sessions={sessions.Count} turns={_turns.Count} failedDelegations={state.Delegations.Count(d => d.Status == "failed")} {AssignmentScanSummary(state)}");
    }

    public static string AssignmentScanSummary(BridgeState state)
    {
        var rows = state.Delegations.Where(d => d.Protocol == 2).ToList();
        return string.Join(" ", new[] { "queued", "running", "waiting", "blocked", "needs_human", "recovery_required", "done", "failed", "cancelled" }
            .Select(workState => $"v2_{workState}={rows.Count(d => d.WorkState == workState)}"));
    }

    string DelegationPrompt(Delegation d) =>
        $"Delegation {d.Key} from session {d.OriginId}.\n\n{d.Prompt}\n\nYour session id is {d.TargetId}. Follow para-session-protocol and write only your own session file.";

    void Fail(Delegation d, string error)
    {
        d.Status = "failed";
        d.LastError = error;
        d.NextAttemptAt = null;
        Log.Error("recover", $"{d.Key}: {error}");
    }

    async Task RecoverAsync(Delegation d, string instructions)
    {
        if (_runtime is null) return;
        if (d.RecoveryAttempts > 0)
        {
            var previous = Message(d.TargetId, MessageId("recovery", d.Key + ":" + d.RecoveryAttempts));
            if (previous is not null && previous.Status != "delivered" && previous.Status != "failed")
            {
                d.NextAttemptAt = previous.NextAttemptAt;
                d.LastError = previous.LastError;
                return;
            }
            if (previous?.Status == "failed")
            {
                Fail(d, $"Recovery delivery exhausted retries: {previous.LastError}");
                return;
            }
            if (!RetryPolicy.IsDue(d.NextAttemptAt, _now())) return;
        }
        if (d.RecoveryAttempts >= 3 || d.CreateSession is null || string.IsNullOrWhiteSpace(d.Prompt))
        {
            Fail(d, "Recovery exhausted or original prompt missing; human intervention is required.");
            return;
        }
        d.RecoveryAttempts++;
        d.NextAttemptAt = _now().AddMinutes(10).ToString("o");
        await QueueAsync(d.TargetId, MessageId("recovery", d.Key + ":" + d.RecoveryAttempts),
            instructions + "\n\nOriginal assignment:\n" + DelegationPrompt(d), createSession: d.CreateSession.Value, agent: d.Agent);
        Log.Warn("recover", $"{d.Key}: queued recovery {d.RecoveryAttempts}/3");
    }

    async Task DailyScrumAsync(BridgeState state, List<SessionFile> sessions)
    {
        var today = _now().ToLocalTime().ToString("yyyy-MM-dd");
        if (state.LastDailyRun == today || _now().ToLocalTime().Hour < _dailyHour) return;
        if (state.DailyRunDate != today)
        {
            state.DailyRunDate = today;
            state.DailyCatchUpSessionIds = sessions.Where(s => s.State == "working" &&
                !SessionHealth.IsStale(s, _now()) && SessionHealth.Issues(s).Count == 0 && s.Agent != "scrum-master" &&
                !state.Delegations.Any(d => d.Protocol == 2 && d.TargetId == s.SessionId &&
                    d.WorkState is "waiting" or "blocked" or "needs_human" or "recovery_required"))
                .Select(s => s.SessionId).ToList();
            Save(state);
        }
        foreach (var id in state.DailyCatchUpSessionIds)
            await QueueAsync(id, MessageId("daily", today), $"Daily catch-up ({today}): briefly report work, state, and blockers; refresh your session file.",
                "scrum-master", timeoutSeconds: 45);
        if (state.DailyCatchUpSessionIds.Any(id => Message(id, MessageId("daily", today))?.Status is not ("delivered" or "failed"))) return;
        state.ScrumMasterId ??= Guid.NewGuid().ToString();
        Save(state);
        var scrumId = MessageId("scrum", today);
        await QueueAsync(state.ScrumMasterId, scrumId,
            $"Daily scrum ({today}): follow your scrum-master instructions. Review data/sessions, inbox, bridge/state.json and bridge.log; surface failures and human needs. Do not resume stale sessions. Your session id is {state.ScrumMasterId}.",
            createSession: true, agent: "scrum-master", timeoutSeconds: 90);
        if (Message(state.ScrumMasterId, scrumId)?.Status == "delivered")
            state.LastDailyRun = today;
    }

    async Task DispatchAsync(BridgeState state)
    {
        foreach (var path in Directory.GetFiles(_inbox, "*.json"))
        {
            var id = Path.GetFileNameWithoutExtension(path);
            if (_turns.ContainsKey(id)) continue;
            var inbox = Json.Read<InboxFile>(path);
            if (inbox is null) continue;
            var session = LoadSession(id);
            // _turns above is authoritative for this Bridge's actively executing SDK turns.
            // A process lock alone denotes an owner, not necessarily an executing turn.
            // Never open a second SDK host into an attended terminal session.
            if (_isLive(id)) continue;
            var needsHuman = AssignmentPolicy.Human(session) || state.Delegations.Any(d =>
                d.Protocol == 2 && d.TargetId == id && d.WorkState is "needs_human" or "recovery_required");
            // Preserve order within a session; independent sessions run concurrently.
            // Human decisions must not be trapped behind automated messages paused by that decision.
            var m = inbox.Messages.FirstOrDefault(m => m.Status != "delivered" &&
                (!needsHuman || m.From == "user") &&
                AssignmentDispatchAllowed(state, id, m, session) &&
                !(m.Status == "failed" && m.Attempts >= RetryPolicy.MaxAttempts));
            if (m is null || !RetryPolicy.IsDue(m.NextAttemptAt, _now())) continue;
            if (m.Attempts >= RetryPolicy.MaxAttempts)
            {
                m.Status = "failed";
                m.LastError ??= "Delivery interrupted at the retry limit; outcome is uncertain.";
                m.NextAttemptAt = null;
                await InboxStore.UpdateMessageAsync(path, m);
                continue;
            }
            if (session?.State == "working" && _lastActivity(id) is { } active && _now() - active < Inspector.SilentAfter)
                continue;
            m.Attempts++;
            m.LastAttemptAt = Now();
            m.Status = "delivering";
            m.LastError = null;
            m.NextAttemptAt = _now().AddSeconds(Math.Max(1, m.TimeoutSeconds) + 60).ToString("o");
            await InboxStore.UpdateMessageAsync(path, m);
            var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            if (!_turns.TryAdd(id, completion.Task)) throw new InvalidOperationException($"Session {id} already has a delivery.");
            _ = DeliverAsync(path, id, m, completion);
        }
    }

    async Task DeliverAsync(string path, string id, InboxMessage m, TaskCompletionSource completion)
    {
        try
        {
            try
            {
                await using var session = await OpenAsync(id, m);
                // A lock identifies a process owner, not an active turn. Remember the SDK
                // server's observed PIDs so its own idle locks don't look like an attended
                // CLI. A different PID (or an orphan across restart) remains conservative.
                if (_trackSdkOwners)
                    foreach (var pid in SessionStore.LiveOwnerIds(id).Where(pid => pid > 0))
                        _sdkOwners.TryAdd(pid, 0);
                var prompt = $"Bridge message {m.Id}, attempt {m.Attempts}/{RetryPolicy.MaxAttempts}. This may be a redelivery; do not repeat completed side effects.\n\n{m.Prompt}";
                try
                {
                    m.Response = await session.SendAsync(prompt, TimeSpan.FromSeconds(Math.Max(1, m.TimeoutSeconds)));
                }
                finally
                {
                    // Some SDK servers acquire the session lock only when sending starts.
                    if (_trackSdkOwners)
                        foreach (var pid in SessionStore.LiveOwnerIds(id).Where(pid => pid > 0))
                            _sdkOwners.TryAdd(pid, 0);
                }
                m.Status = "delivered";
                m.DeliveredAt = Now();
                m.NextAttemptAt = null;
                Log.Info("inbox", $"{id}: {m.Id} delivered");
            }
            catch (Exception e)
            {
                m.LastError = e.Message;
                m.Status = m.Attempts >= RetryPolicy.MaxAttempts ? "failed" : "pending";
                m.NextAttemptAt = m.Status == "failed" ? null : RetryPolicy.NextAttempt(m.Attempts, _now()).ToString("o");
                Log.Error("inbox", $"{id}: {m.Id} attempt {m.Attempts}/{RetryPolicy.MaxAttempts} {m.Status}", e);
            }
            await InboxStore.UpdateMessageAsync(path, m);
        }
        catch (Exception e)
        {
            Log.Error("inbox", $"Could not persist delivery outcome for {id}/{m.Id}; retained claim will be recovered.", e);
        }
        finally
        {
            _turns.TryRemove(id, out _);
            completion.SetResult();
        }
    }

    async Task<IAgentSession> OpenAsync(string id, InboxMessage m)
    {
        try
        {
            return await _runtime!.ResumeAsync(id, new ResumeSessionConfig
            {
                WorkingDirectory = _root, AgentDirectories = new List<string> { Path.Combine(_root, ".github", "agents") },
                OnPermissionRequest = PermissionHandler.ApproveAll,
#pragma warning disable GHCP001
                Autopilot = BridgeAutopilotOptions(),
#pragma warning restore GHCP001
            });
        }
        catch (Exception e) when (m.CreateSession && e.Message.Contains("Session not found", StringComparison.OrdinalIgnoreCase))
        {
            Log.Warn("recover", $"Session {id} does not exist; creating it from its persisted prompt.");
            return await _runtime!.CreateAsync(new SessionConfig
            {
                SessionId = id, WorkingDirectory = _root, Model = _model,
                AgentDirectories = new List<string> { Path.Combine(_root, ".github", "agents") }, Agent = m.Agent,
                OnPermissionRequest = PermissionHandler.ApproveAll,
#pragma warning disable GHCP001
                Autopilot = BridgeAutopilotOptions(),
#pragma warning restore GHCP001
            });
        }
    }

    public async Task WaitForIdleAsync()
    {
        while (!_turns.IsEmpty) await Task.WhenAll(_turns.Values);
    }

    void WriteHumanQueue(List<SessionFile> sessions, BridgeState state)
    {
        var items = sessions.Where(s => s.State != "done" && (s.State == "needs_human" || s.Needs.Any(n => n.Resolver == "human")))
            .Select(s => new { s.SessionId, s.Agent, s.Title, s.State, s.Question,
                Needs = s.Needs.Where(n => n.Resolver == "human").Select(n => n.Text).ToList(), s.Attempts }).ToList();
        foreach (var d in state.Delegations.Where(d => d.Protocol != 2 && d.Status is "failed" or "limit_reached"))
            items.Add(new
            {
                SessionId = d.OriginId, Agent = (string?)"bridge", Title = (string?)"Delegation requires attention",
                State = "needs_human", Question = (string?)$"Resolve delegation {d.Key}: {d.LastError}",
                Needs = new List<string> { d.LastError ?? "Unknown delegation failure" }, Attempts = d.Attempts + d.RecoveryAttempts,
            });
        foreach (var d in state.Delegations.Where(d => d.Protocol == 2 && d.WorkState is "needs_human" or "recovery_required"))
            items.Add(new
            {
                SessionId = d.OriginId, Agent = (string?)"bridge", Title = d.Title,
                State = "needs_human", Question = (string?)(d.Reports.LastOrDefault()?.Question ?? d.LastError ?? $"Resolve assignment {d.Key}"),
                Needs = new List<string> { d.LastError ?? d.Reports.LastOrDefault()?.Summary ?? "Assignment requires human input" },
                Attempts = d.Attempts + d.RecoveryAttempts,
            });
        foreach (var receipt in state.OutboxReceipts.Where(r => r.Error is not null))
            items.Add(new
            {
                SessionId = receipt.SessionId, Agent = (string?)"bridge", Title = (string?)"Outbox command diagnostic",
                State = "needs_human", Question = (string?)$"Command {receipt.CommandId}: {receipt.Error}",
                Needs = new List<string> { receipt.Error! }, Attempts = 0,
            });
        foreach (var path in Directory.GetFiles(_inbox, "*.json"))
            foreach (var m in Json.Read<InboxFile>(path)?.Messages.Where(m => m.Status == "failed") ?? [])
                items.Add(new
                {
                    SessionId = Path.GetFileNameWithoutExtension(path), Agent = (string?)"bridge", Title = (string?)"Message delivery requires attention",
                    State = "needs_human", Question = (string?)$"Resolve message {m.Id}: {m.LastError}",
                    Needs = new List<string> { m.LastError ?? "Unknown delivery failure" }, Attempts = m.Attempts,
                });
        Json.WriteAtomic(Path.Combine(Path.GetDirectoryName(_statePath)!, "human-queue.json"), items);
    }
}
