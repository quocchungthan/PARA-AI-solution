using System.Text.Json;
using System.Text.Json.Serialization;
using System.Globalization;

namespace Bridge;

// data/sessions/<sessionId>.json - written ONLY by the agent session that owns it.
public class SessionFile
{
    List<Need> _needs = new();
    List<ProgressEntry> _progress = new();

    public string SessionId { get; set; } = "";
    public string? Agent { get; set; }
    public string? Title { get; set; }
    public string? TaskType { get; set; }          // feature | bug | research | review | ops | other
    public string? Task { get; set; }
    // working | waiting_input | pending | blocked | needs_human | done
    // needs_human = only Chung can resolve it; the bridge never delegates or retries it, it only surfaces it.
    public string State { get; set; } = "working";
    public List<Need> Needs
    {
        get => _needs;
        set => _needs = value?.Where(n => n is not null).ToList() ?? new();
    }   // what the session really needs
    public string? Question { get; set; }
    public int Attempts { get; set; }                  // times the agent (or helpers) tried to resolve its blocker
    public List<ProgressEntry> Progress
    {
        get => _progress;
        set => _progress = value?.Where(p => p is not null).ToList() ?? new();
    }
    public string? Result { get; set; }                // final output the bridge can feed back to a requester
    public Handoff? Handoff { get; set; }
    public string? UpdatedAt { get; set; }
    // True when the Bridge found this session in Copilot's session-state instead of a data/sessions file.
    [JsonIgnore] public bool Discovered { get; set; }
}

public static class SessionHealth
{
    static readonly HashSet<string> KnownStates = new(StringComparer.Ordinal)
    {
        "working", "waiting_input", "pending", "blocked", "needs_human", "done",
    };

    public static TimeSpan StaleAfter
    {
        get
        {
            return int.TryParse(Environment.GetEnvironmentVariable("PARA_STALE_MINUTES"), out var minutes) && minutes > 0
                ? TimeSpan.FromMinutes(minutes)
                : TimeSpan.FromMinutes(10);
        }
    }

    public static bool IsStale(SessionFile session, DateTimeOffset? now = null)
    {
        if (session.State != "working") return false;
        if (!DateTimeOffset.TryParse(session.UpdatedAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var updatedAt))
            return true;
        return (now ?? DateTimeOffset.UtcNow) - updatedAt.ToUniversalTime() >= StaleAfter;
    }

    public static List<string> Issues(SessionFile session)
    {
        var issues = new List<string>();
        if (session.Discovered)
        {
            // Only a live session can still follow the protocol; an idle one is just history.
            if (session.State == "working")
                issues.Add("not registered: no data/sessions file (agent did not follow para-session-protocol)");
            return issues;
        }
        if (string.IsNullOrWhiteSpace(session.State) || !KnownStates.Contains(session.State))
        {
            issues.Add($"unknown state '{session.State}'");
            return issues;
        }

        if (session.State == "done" && string.IsNullOrWhiteSpace(session.Result))
            issues.Add("done state has no result");
        if (session.State == "waiting_input" && string.IsNullOrWhiteSpace(session.Question) && session.Handoff is null)
            issues.Add("waiting_input state has no question");
        if (session.State == "blocked" && session.Needs.Count == 0)
            issues.Add("blocked state has no needs");
        if (session.State == "needs_human" &&
            (string.IsNullOrWhiteSpace(session.Question) || !session.Needs.Any(n => n.Resolver == "human")))
            issues.Add("needs_human state has no question or human-resolvable need");
        if (session.Attempts >= 3 && session.State != "needs_human" && session.Needs.Count > 0)
            issues.Add("three or more attempts have not been escalated to needs_human");
        if (session.Handoff is not null &&
            (string.IsNullOrWhiteSpace(session.Handoff.Id) || string.IsNullOrWhiteSpace(session.Handoff.Prompt)))
            issues.Add("handoff has no id or prompt");
        return issues;
    }
}

public class Need
{
    public string Text { get; set; } = "";
    public string Resolver { get; set; } = "ai";       // "ai" = another agent/session can solve it; "human" = only Chung (access, credentials, decisions, money, approval)
}

public class ProgressEntry
{
    public string? Ts { get; set; }
    public string? Note { get; set; }
}

public class Handoff
{
    public string Id { get; set; } = "";           // unique per handoff, set by the agent
    public string Target { get; set; } = "new";    // "new" or an existing sessionId
    public string? Agent { get; set; }             // agent name for new sessions
    public string Prompt { get; set; } = "";
    public string? Reason { get; set; }
    public bool WantResult { get; set; } = true;   // feed the target's result back to the origin
}

// data/inbox/<sessionId>.json - written ONLY by the bridge. Messages fed to a session.
public class InboxFile
{
    public List<InboxMessage> Messages { get; set; } = new();
}

public class InboxMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string? From { get; set; }              // "user", "bridge", or originating sessionId
    public string Prompt { get; set; } = "";
    public string Status { get; set; } = "pending"; // pending | delivered | failed
    public string? Response { get; set; }
    public string? CreatedAt { get; set; }
    public string? DeliveredAt { get; set; }
}

public sealed record SessionReplyRequest(string? Message);

// data/bridge/state.json - Bridge-owned bookkeeping.
public class BridgeState
{
    public List<Delegation> Delegations { get; set; } = new();
    public HashSet<string> SeenHandoffs { get; set; } = new();   // "<sessionId>:<handoffId>"
    public string? LastDailyRun { get; set; }                    // local date yyyy-MM-dd of the last scrum-master run
    public string? ScrumMasterId { get; set; }                   // reused so the scrum master keeps its context across days
}

public class Delegation
{
    public string Key { get; set; } = "";          // "<originId>:<handoffId>"
    public string OriginId { get; set; } = "";
    public string TargetId { get; set; } = "";
    public bool WantResult { get; set; }
    // assigned | result_fed | failed | limit_reached
    public string Status { get; set; } = "assigned";
    public string? CreatedAt { get; set; }
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    public static T? Read<T>(string path)
    {
        // Tolerate a writer mid-write; the next tick will retry.
        try { return JsonSerializer.Deserialize<T>(File.ReadAllText(path), Options); }
        catch (Exception e) when (e is IOException or JsonException)
        {
            Bridge.Log.Warn("json", $"cannot read {path}: {e.Message} (will retry next pass)");
            return default;
        }
    }

    public static void WriteAtomic<T>(string path, T value)
    {
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(value, Options));
        File.Move(tmp, path, overwrite: true);
    }
}
