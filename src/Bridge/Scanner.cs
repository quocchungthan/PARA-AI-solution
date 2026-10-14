using GitHub.Copilot;

namespace Bridge;

// Single-pass scan. Each file has exactly one writer: agents write data/sessions, the bridge writes data/inbox and data/bridge.
public class Scanner
{
    readonly string _sessions, _inbox, _statePath, _repoRoot;
    readonly string? _model;
    readonly CopilotClient _client;

    public Scanner(string dataDir, string repoRoot, string? model, CopilotClient client)
    {
        _sessions = Path.Combine(dataDir, "sessions");
        _inbox = Path.Combine(dataDir, "inbox");
        _statePath = Path.Combine(dataDir, "bridge", "state.json");
        _repoRoot = repoRoot;
        _model = model;
        _client = client;
        Directory.CreateDirectory(_sessions);
        Directory.CreateDirectory(_inbox);
        Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
    }

    static string Now() => DateTime.UtcNow.ToString("o");

    public async Task RunOnceAsync()
    {
        var state = File.Exists(_statePath) ? Json.Read<BridgeState>(_statePath) ?? new() : new BridgeState();
        var sessions = Directory.GetFiles(_sessions, "*.json")
            .Select(Json.Read<SessionFile>).Where(s => s is { SessionId.Length: > 0 }).Select(s => s!).ToList();

        // 1. New handoff requests -> delegate to a new or existing session.
        foreach (var s in sessions.Where(s => s.Handoff is { Prompt.Length: > 0 }))
        {
            var h = s.Handoff!;
            var key = $"{s.SessionId}:{h.Id}";
            if (!state.SeenHandoffs.Add(key)) continue;
            var d = new Delegation { Key = key, OriginId = s.SessionId, WantResult = h.WantResult, CreatedAt = Now() };
            try
            {
                var prompt = $"Delegated by session {s.SessionId} ({s.Title}). Reason: {h.Reason}\n\n{h.Prompt}\n\nFollow the para-session-protocol skill and record progress in your own data/sessions file.";
                if (h.Target.Equals("new", StringComparison.OrdinalIgnoreCase))
                {
                    d.TargetId = Guid.NewGuid().ToString();
                    await using var session = await _client.CreateSessionAsync(new SessionConfig
                    {
                        SessionId = d.TargetId,
                        Model = _model,
                        Agent = h.Agent,
                        OnPermissionRequest = PermissionHandler.ApproveAll,
                    });
                    prompt += $"\nYour session id is {d.TargetId}.";
                    await session.SendAndWaitAsync(new MessageOptions { Prompt = prompt }, TimeSpan.FromMinutes(30));
                }
                else
                {
                    d.TargetId = h.Target;
                    await FeedAsync(d.TargetId, prompt);
                }
                Log($"handoff {key} -> {d.TargetId}");
            }
            catch (Exception e) { d.Status = "failed"; Log($"handoff {key} failed: {e.Message}"); }
            state.Delegations.Add(d);
        }

        // 2. Finished delegated work -> feed the result back to the origin session.
        foreach (var d in state.Delegations.Where(d => d.Status == "assigned" && d.WantResult))
        {
            var path = Path.Combine(_sessions, d.TargetId + ".json");
            var target = File.Exists(path) ? Json.Read<SessionFile>(path) : null;
            if (target is null || target.State is not ("done" or "waiting_input" or "blocked")) continue;
            var msg = $"Result of delegation to session {d.TargetId} (state: {target.State}).\nResult: {target.Result}\nQuestion: {target.Question}\nNeeds: {string.Join("; ", target.Needs)}";
            try { await FeedAsync(d.OriginId, msg); d.Status = "result_fed"; }
            catch (Exception e) { Log($"feed-back {d.Key} failed: {e.Message}"); }
        }

        // 3. Pending inbox messages (user/bridge input) -> resume the session and send.
        foreach (var file in Directory.GetFiles(_inbox, "*.json"))
        {
            var inbox = Json.Read<InboxFile>(file);
            if (inbox is null) continue;
            var id = Path.GetFileNameWithoutExtension(file);
            var changed = false;
            foreach (var m in inbox.Messages.Where(m => m.Status == "pending"))
            {
                try { m.Response = await ResumeAndSendAsync(id, m.Prompt); m.Status = "delivered"; }
                catch (Exception e) { m.Status = "failed"; m.Response = e.Message; }
                m.DeliveredAt = Now();
                changed = true;
            }
            if (changed) Json.WriteAtomic(file, inbox);
        }

        Json.WriteAtomic(_statePath, state);

        var waiting = sessions.Where(s => s.State is "waiting_input" or "pending" or "blocked").ToList();
        Log($"scan: {sessions.Count} sessions, {waiting.Count} need attention, {state.Delegations.Count(d => d.Status == "assigned")} delegations open");
    }

    // Queue via the inbox file so there is a record, then deliver on this same pass.
    async Task FeedAsync(string sessionId, string prompt)
    {
        var path = Path.Combine(_inbox, sessionId + ".json");
        var inbox = File.Exists(path) ? Json.Read<InboxFile>(path) ?? new() : new InboxFile();
        var m = new InboxMessage { From = "bridge", Prompt = prompt, CreatedAt = Now() };
        inbox.Messages.Add(m);
        m.Response = await ResumeAndSendAsync(sessionId, prompt);
        m.Status = "delivered";
        m.DeliveredAt = Now();
        Json.WriteAtomic(path, inbox);
    }

    async Task<string?> ResumeAndSendAsync(string sessionId, string prompt)
    {
        await using var session = await _client.ResumeSessionAsync(sessionId, new ResumeSessionConfig
        {
            OnPermissionRequest = PermissionHandler.ApproveAll,
        });
        var reply = await session.SendAndWaitAsync(new MessageOptions { Prompt = prompt }, TimeSpan.FromMinutes(30));
        return (reply?.Data as AssistantMessageData)?.Content;
    }

    static void Log(string s) => Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {s}");
}
