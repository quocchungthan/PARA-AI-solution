using System.Text.Json;

namespace Bridge;

// Read-only view of a Copilot CLI session's own event log (~/.copilot/session-state/<id>/events.jsonl),
// so the dashboard can show whether a "working" session is really doing anything.
public static class Inspector
{
    const int TailBytes = 512 * 1024;
    const int MaxEvents = 40;
    public static readonly TimeSpan SilentAfter = TimeSpan.FromMinutes(5);

    static readonly string Root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".copilot", "session-state");

    public static string EventsPath(string sessionId) => Path.Combine(Root, sessionId, "events.jsonl");

    // Cheap: file metadata only. Used for every session in each snapshot.
    public static DateTimeOffset? LastActivity(string sessionId)
    {
        try
        {
            var p = EventsPath(sessionId);
            return File.Exists(p) ? new DateTimeOffset(File.GetLastWriteTimeUtc(p), TimeSpan.Zero) : null;
        }
        catch (IOException) { return null; }
    }

    public static bool IsSilent(string state, DateTimeOffset? last, DateTimeOffset now) =>
        state == "working" && last is { } l && now - l > SilentAfter;

    public static object Inspect(string sessionId, string state)
    {
        var path = EventsPath(sessionId);
        if (!File.Exists(path))
            return new { sessionId, available = false, diagnosis = "No Copilot event log found for this session on this machine." };

        var now = DateTimeOffset.UtcNow;
        var events = new List<EventSummary>();
        var typeCounts = new Dictionary<string, int>();
        long size;
        try
        {
            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            size = fs.Length;
            fs.Seek(Math.Max(0, size - TailBytes), SeekOrigin.Begin);
            using var sr = new StreamReader(fs);
            var text = sr.ReadToEnd();
            var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            // The first line of a mid-file tail is usually cut off; skip lines that do not parse.
            foreach (var line in lines)
            {
                if (Parse(line) is { } e)
                {
                    events.Add(e);
                    typeCounts[e.Type] = typeCounts.GetValueOrDefault(e.Type) + 1;
                }
            }
        }
        catch (IOException e)
        {
            return new { sessionId, available = false, diagnosis = "Event log is locked or unreadable: " + e.Message };
        }

        var last = events.LastOrDefault();
        DateTimeOffset? lastAt = last?.Timestamp ?? LastActivity(sessionId);
        var silentFor = lastAt is { } la ? now - la : (TimeSpan?)null;

        var pending = events.Where(e => e.Type == "permission.requested" && e.RequestId is not null)
            .Select(e => e.RequestId!)
            .Except(events.Where(e => e.Type == "permission.completed" && e.RequestId is not null).Select(e => e.RequestId!))
            .ToList();
        var failedPrompts = events.Where(e => e.Type == "permission.completed" && e.Detail.Contains("permission_prompt_delivery_failed")).ToList();
        var failedTools = events.Count(e => e.Type == "tool.execution_complete" && e.Detail.StartsWith("failed"));

        return new
        {
            sessionId,
            available = true,
            logBytes = size,
            lastEventAt = lastAt,
            lastEventType = last?.Type,
            silentSeconds = silentFor is { } s ? (int)s.TotalSeconds : (int?)null,
            silent = IsSilent(state, lastAt, now),
            pendingPermissions = pending.Count,
            failedPermissionPrompts = failedPrompts.Count,
            lastFailedPromptAt = failedPrompts.LastOrDefault()?.Timestamp,
            failedToolCalls = failedTools,
            typeCounts = typeCounts.OrderByDescending(kv => kv.Value).Take(8).ToDictionary(kv => kv.Key, kv => kv.Value),
            diagnosis = Diagnose(state, lastAt, now, pending.Count, failedPrompts, last),
            recent = events.Skip(Math.Max(0, events.Count - MaxEvents)).Select(e => new { at = e.Timestamp, type = e.Type, detail = e.Detail }),
        };
    }

    static string Diagnose(string state, DateTimeOffset? lastAt, DateTimeOffset now, int pending,
        List<EventSummary> failedPrompts, EventSummary? last)
    {
        var silent = IsSilent(state, lastAt, now);
        var ago = lastAt is { } l ? $"{(int)(now - l).TotalMinutes} min" : "unknown time";
        if (last is { Type: "permission.completed" } && last.Detail.Contains("permission_prompt_delivery_failed"))
            return $"Stuck: the last action was a permission prompt that could not be delivered (no session host), {ago} ago. Resume the session in a terminal or restart it.";
        if (pending > 0 && silent)
            return $"Stuck: waiting on {pending} permission prompt(s) nobody answered for {ago}.";
        if (pending > 0)
            return $"Waiting on {pending} permission prompt(s).";
        if (silent)
            return $"Silent for {ago} while state is working. The process may have exited or hung.";
        if (failedPrompts.Count > 0)
            return $"Active, but {failedPrompts.Count} permission prompt(s) failed in the recent log.";
        return state == "working" ? "Active." : $"No activity check needed (state {state}).";
    }

    static EventSummary? Parse(string line)
    {
        try
        {
            using var doc = JsonDocument.Parse(line);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("type", out var t)) return null;
            DateTimeOffset ts = default;
            if (root.TryGetProperty("timestamp", out var tsEl) && tsEl.ValueKind == JsonValueKind.String)
                DateTimeOffset.TryParse(tsEl.GetString(), out ts);
            root.TryGetProperty("data", out var data);
            var type = t.GetString() ?? "";
            return new EventSummary(ts, type, Str(data, "requestId"), Describe(type, data));
        }
        catch (JsonException) { return null; }
    }

    static string? Str(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    static string Describe(string type, JsonElement data)
    {
        if (data.ValueKind != JsonValueKind.Object) return "";
        switch (type)
        {
            case "permission.completed":
                if (data.TryGetProperty("result", out var r))
                    return $"{Str(r, "kind")} {Str(r, "reason")}".Trim();
                break;
            case "permission.requested":
                if (data.TryGetProperty("permissionRequest", out var pr))
                    return Cut($"{Str(pr, "kind")}: {Str(pr, "intention") ?? Str(pr, "fullCommandText") ?? Str(pr, "toolName")}");
                break;
            case "tool.execution_start":
                return Cut(Str(data, "toolName") ?? "");
            case "tool.execution_complete":
                var ok = data.TryGetProperty("success", out var sv) && sv.ValueKind == JsonValueKind.True;
                var err = data.TryGetProperty("error", out var ev) ? Str(ev, "message") : null;
                return ok ? "ok" : Cut("failed " + err);
            case "assistant.message":
                return Cut(Str(data, "content") ?? "");
            case "user.message":
                return Cut(Str(data, "content") ?? "");
        }
        return "";
    }

    static string Cut(string s)
    {
        s = s.ReplaceLineEndings(" ");
        return s.Length <= 220 ? s : s[..220] + "…";
    }

    sealed record EventSummary(DateTimeOffset Timestamp, string Type, string? RequestId, string Detail);
}
