using System.Text.Json.Serialization;

namespace Bridge;

public sealed record AssignmentScheduling(string Code, string Summary, List<string> BlockingAssignmentIds);

public sealed class TaskEstimate
{
    public int Points { get; set; }
    public string Rationale { get; set; } = "";
}

public sealed class OutboxCommand
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string? Title { get; set; }
    public string? Prompt { get; set; }
    public int Points { get; set; }
    public string? Mode { get; set; }
    public string? Agent { get; set; }
    public List<string> Acceptance { get; set; } = new();
    public List<string> DependsOn { get; set; } = new();
    public List<string> Writes { get; set; } = new();
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AccessMode { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Reads { get; set; }
    public string? ApprovalRef { get; set; }
    public string? AssignmentId { get; set; }
    public string? ReportKind { get; set; }
    public string? Summary { get; set; }
    public List<string> Evidence { get; set; } = new();
    public string? Verification { get; set; }
    public string? Question { get; set; }
}

public sealed class AssignmentReport
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Summary { get; set; } = "";
    public List<string> Evidence { get; set; } = new();
    public string? Verification { get; set; }
    public string? Question { get; set; }
    public string CreatedAt { get; set; } = "";
}

public sealed class OutboxReceipt
{
    public string SessionId { get; set; } = "";
    public string CommandId { get; set; } = "";
    public string PayloadHash { get; set; } = "";
    public string Status { get; set; } = "";
    public string? AssignmentId { get; set; }
    public string? Error { get; set; }
    // One diagnostic per immutable ID, without accepting a replacement payload.
    public string? CollisionHash { get; set; }
}
