using GitHub.Copilot;

namespace Bridge;

// Single-pass scan. Each file has exactly one writer: agents write data/sessions, the bridge writes data/inbox and data/bridge.
public class Scanner
{
    const string C = "scan";
    readonly string _sessions, _inbox, _statePath;
    readonly string? _model;
    readonly CopilotClient? _client;
    int _pass;
    readonly List<string> _agentDirs;
    // Every session is pinned to the PARA-AI-solution root so it is listed by `copilot --resume` there.
    readonly string _root;
    readonly int _maxDepth = int.TryParse(Environment.GetEnvironmentVariable("PARA_MAX_DEPTH"), out var md) ? md : 3;
    readonly int _maxHandoffs = int.TryParse(Environment.GetEnvironmentVariable("PARA_MAX_HANDOFFS"), out var mh) ? mh : 5;
    static readonly TimeSpan DailyCatchUpTimeout = TimeSpan.FromSeconds(45);
    static readonly TimeSpan DailyScrumTimeout = TimeSpan.FromSeconds(90);

    // How many delegation hops lead to this session (0 = started by a human).
    static int DepthOf(BridgeState state, string sessionId, int guard = 0)
    {
        var parent = state.Delegations.FirstOrDefault(x => x.TargetId == sessionId);
        return parent is null || guard > 20 ? 0 : 1 + DepthOf(state, parent.OriginId, guard + 1);
    }

    // Writes data/bridge/human-queue.json: everything only Chung can resolve.
    void WriteHumanQueue(List<SessionFile> sessions)
    {
        var items = sessions
            .Where(s => s.State == "needs_human" || s.Needs.Any(n => n.Resolver == "human") && s.State != "done")
            .Select(s => new { s.SessionId, s.Agent, s.Title, s.State, s.Question, Needs = s.Needs.Where(n => n.Resolver == "human").Select(n => n.Text), s.Attempts })
            .ToList();
        Json.WriteAtomic(Path.Combine(Path.GetDirectoryName(_statePath)!, "human-queue.json"), items);
        foreach (var i in items) Log.Warn("human", $"WAITING FOR CHUNG: session {i.SessionId} ({i.Agent}) \"{Log.Short(i.Title, 60)}\" question=\"{Log.Short(i.Question)}\" needs=[{Log.Short(string.Join("; ", i.Needs))}]");
    }
    readonly int _dailyHour;

    public Scanner(string dataDir, string repoRoot, string? model, int dailyHour, CopilotClient? client)
    {
        _agentDirs = new() { Path.Combine(repoRoot, ".github", "agents") };
        _root = repoRoot;
        _dailyHour = dailyHour;
        _sessions = Path.Combine(dataDir, "sessions");
        _inbox = Path.Combine(dataDir, "inbox");
        _statePath = Path.Combine(dataDir, "bridge", "state.json");
        _model = model;
        _client = client;
        Directory.CreateDirectory(_sessions);
        Directory.CreateDirectory(_inbox);
        Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
    }

    static string Now() => DateTime.UtcNow.ToString("o");

    public async Task RunOnceAsync()
    {
        var pass = ++_pass;
        var sw = System.Diagnostics.Stopwatch.StartNew();
        Log.Info(C, $"pass #{pass} start");

        var state = File.Exists(_statePath) ? Json.Read<BridgeState>(_statePath) ?? new() : new BridgeState();
        var files = Directory.GetFiles(_sessions, "*.json");
        Log.Debug(C, $"found {files.Length} session file(s) in {_sessions}");
        var sessions = new List<SessionFile>();
        foreach (var f in files)
        {
            var s = Json.Read<SessionFile>(f);
            if (s is null || s.SessionId.Length == 0) { Log.Warn(C, $"skipping {Path.GetFileName(f)}: unreadable or missing sessionId"); continue; }
            sessions.Add(s);
            if (s.State == "done") continue;
            Log.Debug(C, $"session {s.SessionId} agent={s.Agent} type={s.TaskType} state={s.State} title=\"{Log.Short(s.Title, 60)}\" handoff={(s.Handoff is null ? "none" : s.Handoff.Id)}");
        }

        // Without an available agent runtime nothing can be delegated or delivered; keep surfacing the human queue.
        if (_client is null)
        {
            WriteHumanQueue(sessions);
            Log.Warn(C, $"pass #{pass} skipped delegation/inbox/daily: no agent runtime available");
            return;
        }

        // Daily catch-up is exclusive: while it runs nothing else is processed; normal work resumes next pass.
        if (await DailyScrumAsync(state, sessions))
        {
            Json.WriteAtomic(_statePath, state);
            Log.Info(C, $"pass #{pass} was the daily catch-up ({sw.ElapsedMilliseconds}ms); normal processing resumes next pass");
            return;
        }

        // 1. New handoff requests -> delegate to a new or existing session.
        foreach (var s in sessions.Where(s => s.Handoff is { Prompt.Length: > 0 }))
        {
            var h = s.Handoff!;
            var key = $"{s.SessionId}:{h.Id}";
            if (!state.SeenHandoffs.Add(key)) { Log.Debug("handoff", $"{key} already processed"); continue; }
            Log.Info("handoff", $"NEW {key} from={s.SessionId} target={h.Target} agent={h.Agent} wantResult={h.WantResult} reason=\"{Log.Short(h.Reason)}\" prompt=\"{Log.Short(h.Prompt)}\"");
            var d = new Delegation { Key = key, OriginId = s.SessionId, WantResult = h.WantResult, CreatedAt = Now() };

            // Breakpoint: stop endless delegation chains and ping-pong; hand the problem to the human.
            var depth = DepthOf(state, s.SessionId) + 1;
            var count = state.Delegations.Count(x => x.OriginId == s.SessionId) + 1;
            if (depth > _maxDepth || count > _maxHandoffs)
            {
                d.Status = "limit_reached";
                state.Delegations.Add(d);
                var why = depth > _maxDepth ? $"delegation depth {depth} exceeds {_maxDepth}" : $"{count} handoffs from this session exceeds {_maxHandoffs}";
                Log.Warn("breakpoint", $"{key} NOT delegated: {why}. Telling origin to escalate to a human.");
                try { await FeedAsync(s.SessionId, $"BREAKPOINT: your handoff {h.Id} was refused by the bridge ({why}). Do not delegate further. Set state to needs_human, list what only Chung can resolve in needs (resolver: human), state your single question, and stop.", "bridge"); }
                catch (Exception e) { Log.Error("breakpoint", $"{key} could not notify origin", e); }
                continue;
            }
            try
            {
                var prompt = $"Delegated by session {s.SessionId} ({s.Title}). Reason: {h.Reason}\n\n{h.Prompt}\n\nFollow the para-session-protocol skill and record progress in your own data/sessions file.";
                if (h.Target.Equals("new", StringComparison.OrdinalIgnoreCase))
                {
                    d.TargetId = Guid.NewGuid().ToString();
                    Log.Info("handoff", $"{key} creating NEW session {d.TargetId} agent={h.Agent ?? "(default)"} model={_model ?? "(default)"}");
                    // Not `await using`: the background turn owns the session and disposes it when finished.
                    var session = await _client!.CreateSessionAsync(new SessionConfig
                    {
                        SessionId = d.TargetId,
                        WorkingDirectory = _root,
                        Model = _model,
                        AgentDirectories = _agentDirs,
                        Agent = h.Agent,
                        OnPermissionRequest = PermissionHandler.ApproveAll,
                    });
                    try
                    {
                        Attach(session, d.TargetId);
                        prompt += $"\nYour session id is {d.TargetId}.";
                        // Fire and forget: the result comes back through the target's session file (step 2), not this turn.
                        StartBackgroundTurn(session, d.TargetId, key, prompt);
                    }
                    catch { await session.DisposeAsync(); throw; }
                }
                else
                {
                    d.TargetId = h.Target;
                    Log.Info("handoff", $"{key} feeding EXISTING session {d.TargetId}");
                    await FeedAsync(d.TargetId, prompt);
                }
                Log.Info("handoff", $"{key} assigned -> {d.TargetId}");
            }
            catch (Exception e) { d.Status = "failed"; Log.Error("handoff", $"{key} FAILED", e); }
            state.Delegations.Add(d);
        }

        // 2. Finished delegated work -> feed the result back to the origin session.
        var open = state.Delegations.Where(d => d.Status == "assigned" && d.WantResult).ToList();
        Log.Debug("result", $"{open.Count} open delegation(s) awaiting result");
        foreach (var d in open)
        {
            var path = Path.Combine(_sessions, d.TargetId + ".json");
            var target = File.Exists(path) ? Json.Read<SessionFile>(path) : null;
            if (target is null) { Log.Debug("result", $"{d.Key}: target {d.TargetId} has no session file yet (agent has not registered)"); continue; }
            if (target.State is not ("done" or "waiting_input" or "blocked" or "needs_human")) { Log.Debug("result", $"{d.Key}: target {d.TargetId} state={target.State}, still running"); continue; }
            if (_busy.ContainsKey(d.OriginId)) { Log.Debug("result", $"{d.Key}: origin {d.OriginId} is mid-turn, will feed next pass"); continue; }
            var msg = $"Result of delegation to session {d.TargetId} (state: {target.State}).\nResult: {target.Result}\nQuestion: {target.Question}\nNeeds: {string.Join("; ", target.Needs.Select(n => $"[{n.Resolver}] {n.Text}"))}";
            Log.Info("result", $"{d.Key}: target {d.TargetId} state={target.State}; feeding back to origin {d.OriginId}");
            try { await FeedAsync(d.OriginId, msg); d.Status = "result_fed"; Log.Info("result", $"{d.Key} result_fed"); }
            catch (Exception e) { Log.Error("result", $"{d.Key} feed-back failed (will retry next pass)", e); }
        }

        // 3. Pending inbox messages (user/bridge input) -> resume the session and send.
        foreach (var file in Directory.GetFiles(_inbox, "*.json"))
        {
            var inbox = Json.Read<InboxFile>(file);
            if (inbox is null) continue;
            var id = Path.GetFileNameWithoutExtension(file);
            var pending = inbox.Messages.Where(m => m.Status == "pending").ToList();
            Log.Debug("inbox", $"{id}: {inbox.Messages.Count} message(s), {pending.Count} pending");
            foreach (var m in pending)
            {
                Log.Info("inbox", $"{id}: delivering {m.Id} from={m.From} prompt=\"{Log.Short(m.Prompt)}\"");
                try { m.Response = await ResumeAndSendAsync(id, m.Prompt); m.Status = "delivered"; Log.Info("inbox", $"{id}: {m.Id} delivered"); }
                catch (Exception e) { m.Status = "failed"; m.Response = e.Message; Log.Error("inbox", $"{id}: {m.Id} FAILED", e); }
                m.DeliveredAt = Now();
                await InboxStore.UpdateMessageAsync(file, m);
            }
        }

        Json.WriteAtomic(_statePath, state);
        WriteHumanQueue(sessions);

        var stale = sessions.Where(s => SessionHealth.IsStale(s)).ToList();
        foreach (var s in stale)
            Log.Warn("stale", $"session {s.SessionId} state=working has not updated since \"{s.UpdatedAt ?? "(missing)"}\"; agent owns its session file, so Bridge did not change its state");
        var invalid = sessions.Select(s => (Session: s, Issues: SessionHealth.Issues(s))).Where(x => x.Issues.Count > 0).ToList();
        foreach (var item in invalid)
            Log.Warn("session", $"session {item.Session.SessionId} has protocol issue(s): {string.Join("; ", item.Issues)}");
        var attention = sessions.Where(s => s.State is "waiting_input" or "pending" or "blocked").ToList();
        foreach (var s in attention)
            Log.Warn("attention", $"session {s.SessionId} state={s.State} question=\"{Log.Short(s.Question)}\" needs=[{Log.Short(string.Join("; ", s.Needs.Select(n => n.Text)))}]");
        var attentionCount = sessions.Count(s => s.State is "waiting_input" or "pending" or "blocked" ||
            SessionHealth.IsStale(s) || SessionHealth.Issues(s).Count > 0);
        Log.Info(C, $"pass #{pass} done in {sw.ElapsedMilliseconds}ms: sessions={sessions.Count} attention={attentionCount} stale={stale.Count} invalid={invalid.Count} openDelegations={state.Delegations.Count(d => d.Status == "assigned")} failedDelegations={state.Delegations.Count(d => d.Status == "failed")}");
    }

    // Once per local day after PARA_DAILY_HOUR: catch up with every open session one by one, then run the scrum master. Returns true if it ran.
    async Task<bool> DailyScrumAsync(BridgeState state, List<SessionFile> sessions)
    {
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        if (state.LastDailyRun == today) { Log.Debug("daily", $"already ran today ({today})"); return false; }
        if (DateTime.Now.Hour < _dailyHour) { Log.Debug("daily", $"waiting for hour {_dailyHour}"); return false; }

        // Mark first so a crash or long run cannot trigger it again the same day.
        state.LastDailyRun = today;
        Json.WriteAtomic(_statePath, state);
        Log.Info("daily", $"starting daily catch-up for {today}");

        var stale = sessions.Where(s => SessionHealth.IsStale(s)).ToList();
        var invalid = sessions.Where(s => SessionHealth.Issues(s).Count > 0).ToList();
        var open = sessions.Where(s => s.State == "working" && !SessionHealth.IsStale(s) &&
            SessionHealth.Issues(s).Count == 0 && !string.Equals(s.Agent, "scrum-master", StringComparison.OrdinalIgnoreCase)).ToList();
        Log.Info("daily", $"catch-up candidates={open.Count} staleWorking={stale.Count} (stale threshold {SessionHealth.StaleAfter.TotalMinutes:0}m)");
        await Task.WhenAll(open.Select(async s =>
        {
            Log.Info("daily", $"catch-up with {s.SessionId} (state={s.State}) ...");
            try
            {
                await FeedAsync(s.SessionId, $"Daily catch-up ({today}). Reply briefly: what you did since last time, current state, anything blocking you or needed from others. Refresh your data/sessions file too.", "scrum-master", DailyCatchUpTimeout);
                Log.Info("daily", $"catch-up with {s.SessionId} done");
            }
            catch (Exception e) { Log.Error("daily", $"catch-up with {s.SessionId} failed or timed out (continuing)", e); }
        }));

        try
        {
            var staleSummary = stale.Count == 0
                ? "No stale working sessions were detected."
                : $"Stale working sessions (do not resume them): {string.Join("; ", stale.Select(s => $"{s.SessionId} \"{Log.Short(s.Title, 60)}\" updatedAt={s.UpdatedAt ?? "(missing)"}"))}.";
            var invalidSummary = invalid.Count == 0
                ? "No session protocol issues were detected."
                : $"Sessions with protocol issues (do not resume them): {string.Join("; ", invalid.Select(x => $"{x.SessionId}: {string.Join(", ", SessionHealth.Issues(x))}"))}.";
            var prompt = $"Daily scrum for {today}. Review the team per your instructions. {open.Count} active session(s) were asked for a catch-up; their replies are in data/inbox/<id>.json (response) and their session files. {staleSummary} {invalidSummary} Intervene and improve as needed. Reply with a short health summary.";
            var existingScrumMaster = sessions.FirstOrDefault(s => s.SessionId == state.ScrumMasterId);
            if (state.ScrumMasterId is null || existingScrumMaster is null || SessionHealth.IsStale(existingScrumMaster))
            {
                if (state.ScrumMasterId is not null)
                    Log.Warn("daily", $"scrum-master session {state.ScrumMasterId} is missing or stale; creating a fresh session");
                var id = Guid.NewGuid().ToString();
                Log.Info("daily", $"creating scrum-master session {id}");
                await using var session = await _client!.CreateSessionAsync(new SessionConfig
                {
                    SessionId = id,
                    WorkingDirectory = _root,
                    Model = _model,
                    AgentDirectories = _agentDirs,
                    Agent = "scrum-master",
                    OnPermissionRequest = PermissionHandler.ApproveAll,
                });
                state.ScrumMasterId = id;
                Json.WriteAtomic(_statePath, state);
                Attach(session, id);
                var reply = await session.SendAndWaitAsync(new MessageOptions { Prompt = prompt + $" Your session id is {id}." }, DailyScrumTimeout);
                Log.Info("daily", $"scrum master summary: \"{Log.Short((reply?.Data as AssistantMessageData)?.Content, 400)}\"");
            }
            else
            {
                Log.Info("daily", $"resuming scrum-master session {state.ScrumMasterId}");
                Log.Info("daily", $"scrum master summary: \"{Log.Short(await ResumeAndSendAsync(state.ScrumMasterId, prompt, DailyScrumTimeout), 400)}\"");
            }
        }
        catch (Exception e) { Log.Error("daily", "scrum master run failed or timed out", e); }
        return true;
    }

    readonly System.Collections.Concurrent.ConcurrentDictionary<string, byte> _busy = new();

    void StartBackgroundTurn(CopilotSession session, string id, string key, string prompt)
    {
        _busy[id] = 0;
        _ = Task.Run(async () =>
        {
            try
            {
                var reply = await session.SendAndWaitAsync(new MessageOptions { Prompt = prompt }, TimeSpan.FromMinutes(30));
                Log.Info("handoff", $"{key} session {id} turn finished, reply=\"{Log.Short((reply?.Data as AssistantMessageData)?.Content)}\"");
            }
            catch (Exception e) { Log.Error("handoff", $"{key} session {id} turn failed", e); }
            finally { _busy.TryRemove(id, out _); await session.DisposeAsync(); }
        });
    }

    // Queue via the inbox file so there is a record, then deliver on this same pass.
    async Task FeedAsync(string sessionId, string prompt, string from = "bridge", TimeSpan? timeout = null)
    {
        var path = Path.Combine(_inbox, sessionId + ".json");
        var m = new InboxMessage { From = from, Prompt = prompt, CreatedAt = Now() };
        await InboxStore.EnqueueAsync(path, m);
        try
        {
            m.Response = await ResumeAndSendAsync(sessionId, prompt, timeout);
            m.Status = "delivered";
        }
        catch { m.Status = "failed"; throw; }
        finally { m.DeliveredAt = Now(); await InboxStore.UpdateMessageAsync(path, m); }
    }

    async Task<string?> ResumeAndSendAsync(string sessionId, string prompt, TimeSpan? timeout = null)
    {
        Log.Info("sdk", $"resuming session {sessionId}");
        await using var session = await _client!.ResumeSessionAsync(sessionId, new ResumeSessionConfig
        {
            WorkingDirectory = _root,
            AgentDirectories = _agentDirs,
            OnPermissionRequest = PermissionHandler.ApproveAll,
        });
        Attach(session, sessionId);
        Log.Info("sdk", $"sending to {sessionId}: \"{Log.Short(prompt)}\"");
        var reply = await session.SendAndWaitAsync(new MessageOptions { Prompt = prompt }, timeout ?? TimeSpan.FromMinutes(30));
        var content = (reply?.Data as AssistantMessageData)?.Content;
        Log.Info("sdk", $"{sessionId} replied: \"{Log.Short(content)}\"");
        return content;
    }

    // Trace every SDK event so a stuck or failing session is visible.
    static void Attach(CopilotSession session, string id) =>
        session.On<SessionEvent>(evt =>
        {
            if (evt is AssistantMessageEvent) return;
            Log.Debug("sdk-event", $"{id} {evt.GetType().Name}");
        });
}
