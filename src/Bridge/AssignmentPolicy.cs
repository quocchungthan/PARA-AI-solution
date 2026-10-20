using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Bridge;

// Validation and scheduling are deterministic. ApprovalRef records cooperative provenance,
// not a claim that code understands a natural-language approval or enforces permissions.
public static class AssignmentPolicy
{
    public static string Key(string origin, string command) => $"{origin}:out:{command}";
    public static string Hash(OutboxCommand command) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(command, Json.Options))));

    public static int MaxParallel =>
        int.TryParse(Environment.GetEnvironmentVariable("PARA_MAX_PARALLEL"), out var value) && value > 0 ? value : 2;

    public static bool Human(SessionFile? session) => session is not null &&
        (session.State == "needs_human" || session.Phase == "approval" || session.Needs.Any(n => n.Resolver == "human"));

    public static bool Closed(Delegation row) => row.WorkState is "done" or "failed" or "cancelled";
    // Waiting/blocked workers may still be editing or have an uncertain runtime outcome.
    // A supervisor that explicitly waits for its own children is instead suspended (see Reconcile).
    public static bool Holds(Delegation row) => row.Protocol == 2 && row.Status != "queued" &&
        row.WorkState is "running" or "waiting" or "blocked" or "needs_human" or "recovery_required";

    public static bool Suspended(Delegation row, BridgeState state, Func<string, bool>? active = null) =>
        row.WorkState == "waiting" && row.Reports.LastOrDefault()?.Kind == "waiting" &&
        active?.Invoke(row.TargetId) != true &&
        state.Delegations.Any(d => d.Protocol == 2 && d.ParentKey == row.Key);

    public static string NormalizePath(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Writes contains an empty path.");
        var path = value.Replace('\\', '/').TrimEnd('/');
        if (path.Length == 0 || path.StartsWith('/') || path.Contains(':') ||
            path.IndexOfAny(['*', '?', '[', ']', '\0']) >= 0 ||
            path.Split('/').Any(p => p.Length == 0 || p is "." or ".." || p != p.Trim() || p.EndsWith('.') ||
                p.IndexOfAny(['<', '>', '|', '"']) >= 0))
            throw new ArgumentException($"Invalid repository-relative Writes path: {value}");
        return path;
    }

    public static bool ContainsPath(string parent, string child) =>
        child.Equals(parent, StringComparison.OrdinalIgnoreCase) ||
        child.StartsWith(parent + "/", StringComparison.OrdinalIgnoreCase);

    public static bool Overlaps(IReadOnlyCollection<string> left, IReadOnlyCollection<string> right) =>
        left.Count == 0 || right.Count == 0 ||
        left.Any(a => right.Any(b => ContainsPath(a, b) || ContainsPath(b, a)));

    public static bool ReadOnly(Delegation row) => row.AccessMode == "read_only";

    public static bool Conflicts(Delegation left, Delegation right)
    {
        if (ReadOnly(left) && ReadOnly(right)) return false;
        if (ReadOnly(left)) return Overlaps(left.Reads ?? [], right.Writes);
        if (ReadOnly(right)) return Overlaps(left.Writes, right.Reads ?? []);
        return Overlaps(left.Writes, right.Writes) ||
            left.Reads is not null && Overlaps(left.Reads, right.Writes) ||
            right.Reads is not null && Overlaps(left.Writes, right.Reads);
    }

    public static string? ValidateBatch(SessionFile origin, IReadOnlyList<OutboxCommand> commands, BridgeState state)
    {
        if (origin.State == "done" || Human(origin)) return "Origin is done or awaiting human input; requests are gated.";
        Delegation? parent = null;
        if (origin.Work is not null)
        {
            parent = state.Delegations.SingleOrDefault(d => d.Key == origin.Work);
            if (parent is null || parent.Protocol != 2 || parent.TargetId != origin.SessionId ||
                parent.WorkState != "running")
                return "Work must identify an owned running assignment.";
            var visited = new HashSet<string>();
            for (var p = parent; p is not null;)
            {
                if (!visited.Add(p.Key)) return "Cyclic assignment ancestry.";
                if (p.ParentKey is null) break;
                p = state.Delegations.FirstOrDefault(d => d.Key == p.ParentKey);
                if (p is null) return "Unknown assignment ancestry.";
            }
        }
        var root = parent?.RootKey ?? parent?.Key;
        if (commands.Count(c => c.Mode == "new") +
            state.Delegations.Count(d => d.Protocol == 2 && d.Mode == "new" &&
                (root is null ? d.OriginId == origin.SessionId : d.RootKey == root)) > 12)
            return "V2 child limit (12 per root) reached.";

        var ids = commands.Select(c => c.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var c in commands)
        {
            if (string.IsNullOrWhiteSpace(c.Id)) return "Command ID must be stable and nonempty.";
            if (c.Points is < 1 or > 2) return "Executable requests must be 1–2 points; decompose larger tasks.";
            if (c.Mode is not ("self" or "new")) return "Mode must be self or new.";
            if (string.IsNullOrWhiteSpace(c.Title) || string.IsNullOrWhiteSpace(c.Prompt) ||
                string.IsNullOrWhiteSpace(c.ApprovalRef) || c.Acceptance is null || c.Acceptance.Count == 0 ||
                c.Acceptance.Any(string.IsNullOrWhiteSpace)) return "Title, prompt, acceptance and approvalRef are required.";
            if (c.Writes is null || c.DependsOn is null) return "Writes and dependsOn must be lists.";
            if (c.AccessMode is not (null or "read_only" or "write")) return "AccessMode must be read_only or write.";
            if (c.AccessMode == "read_only" && c.Writes.Count > 0) return "Read-only requests cannot declare Writes.";
            if (parent is not null && c.ApprovalRef != parent.ApprovalRef)
                return "Child approvalRef must exactly match the parent approvalRef.";
            try
            {
                var writes = c.Writes.Select(NormalizePath).ToList();
                var reads = c.Reads?.Select(NormalizePath).ToList();
                if (parent is not null && ReadOnly(parent))
                {
                    if (c.AccessMode != "read_only") return "Read-only parents cannot create writers.";
                    if (parent.Reads is { Count: > 0 } &&
                        (reads is not { Count: > 0 } || reads.Any(r => !parent.Reads.Any(p => ContainsPath(p, r)))))
                        return "Child Reads must stay within its parent approved scope.";
                }
                else if (parent is not null && parent.Writes.Count > 0 &&
                    c.AccessMode == "read_only" &&
                    (reads is not { Count: > 0 } || reads.Any(r => !parent.Writes.Concat(parent.Reads ?? []).Any(p => ContainsPath(p, r)))))
                    return "Child Reads must stay within its parent approved scope.";
                if (parent is not null && !ReadOnly(parent) && c.AccessMode != "read_only" && parent.Writes.Count > 0 &&
                    (writes.Count == 0 || writes.Any(w => !parent.Writes.Any(p => ContainsPath(p, w)))))
                    return "Child Writes must stay within its parent approved scope.";
                if (parent is not null && !ReadOnly(parent) && c.AccessMode != "read_only" &&
                    parent.Writes.Count > 0 && reads is not null &&
                    (reads.Count == 0 || reads.Any(r => !parent.Writes.Concat(parent.Reads ?? []).Any(p => ContainsPath(p, r)))))
                    return "Child Reads must stay within its parent approved scope.";
            }
            catch (ArgumentException e) { return e.Message; }
            foreach (var dependency in c.DependsOn)
            {
                if (dependency == c.Id) return "Dependency cycle.";
                if (!ids.Contains(dependency) && !state.Delegations.Any(d => d.Protocol == 2 &&
                    d.OriginId == origin.SessionId && d.Key == Key(origin.SessionId, dependency)))
                    return $"Unknown same-origin dependency: {dependency}";
            }
        }
        var visiting = new HashSet<string>();
        var complete = new HashSet<string>();
        bool Visit(string id)
        {
            if (complete.Contains(id)) return true;
            if (!visiting.Add(id)) return false;
            var c = commands.FirstOrDefault(c => c.Id == id);
            if (c is not null && c.DependsOn.Where(ids.Contains).Any(d => !Visit(d))) return false;
            visiting.Remove(id);
            complete.Add(id);
            return true;
        }
        return ids.All(Visit) ? null : "Dependency cycle.";
    }

    public static string? Gate(Delegation row, BridgeState state, Func<string, SessionFile?> session,
        Func<string, bool>? active = null) => GrantReason(row, state, session, active)?.Summary;

    // Read-only projection. This does not claim that a runtime is connected, a turn is
    // executing, or the Bridge has scanned the current snapshot yet.
    public static AssignmentScheduling DescribeScheduling(Delegation row, BridgeState state,
        Func<string, SessionFile?> session, Func<string, bool>? active = null)
    {
        AssignmentScheduling Reason(string code, string summary) => new(code, summary, []);
        if (row.Protocol != 2) return Reason("legacy", "Legacy delegation; see its transport status.");
        if (row.WorkState == "recovery_required")
            return Reason("recovery_required", row.LastError ?? "Ownership is retained pending human reconciliation.");
        if (Closed(row)) return Reason(row.WorkState!, $"Assignment is {row.WorkState}.");
        if (row.WorkState == "needs_human")
            return Reason("needs_human", row.Reports.LastOrDefault()?.Question ?? "Worker requires human input; automation is paused.");
        if (row.WorkState == "waiting")
            return Reason("explicit_waiting", Suspended(row, state, active)
                ? "Worker explicitly waits for children; its cooperative reservation is suspended."
                : "Worker explicitly waits; reservation remains held until it can safely yield.");
        // A dependency blocker recorded before grant remains derived from the same gate.
        if (row.WorkState == "blocked" && row.Status != "queued")
            return Reason("explicit_blocked", row.Reports.LastOrDefault()?.Summary ?? row.LastError ?? "Worker explicitly reported a blocker.");
        if (row.WorkState == "running" && row.Mode == "self")
            return Reason("self_granted", "Reserved by the owning attended CLI, not automatically executing. Continue that existing CLI to report or safely close the assignment; never start a duplicate worker.");
        if (row.WorkState == "running")
            return Reason("granted", "Granted to saved worker; inbox delivery and explicit reports determine progress.");
        return GrantReason(row, state, session, active) ??
            Reason("ready", "Scheduling gates are clear; awaiting the next Bridge scan.");
    }

    public static AssignmentScheduling? GrantReason(Delegation row, BridgeState state, Func<string, SessionFile?> session,
        Func<string, bool>? active = null)
    {
        AssignmentScheduling Reason(string code, string summary, IEnumerable<Delegation>? blockers = null)
        {
            var rows = blockers?.DistinctBy(d => d.Key).ToList() ?? [];
            var details = rows.Count == 0 ? "" : " Blockers: " +
                string.Join("; ", rows.Select(d => $"{d.Key} ({d.Title ?? "Untitled assignment"})" +
                    (d.Protocol == 2 && !ReadOnly(d) && d.Writes.Count == 0 ? " [repository-exclusive Writes=[]]" : ""))) + ".";
            return new(code, summary + details, rows.Select(d => d.Key).ToList());
        }
        if (Human(session(row.OriginId))) return Reason("human_origin", "Origin requires human input.");
        // Queued self requests have no executor handshake. Do not turn an idle CLI
        // into a running reservation. Already granted work retains its ownership.
        if (row.Mode == "self" && row.Status == "queued")
            return Reason("executor_required",
                "Attended CLI request has no automatic executor. Its owner must cancel this ungranted request and continue directly, or submit a new managed-worker request. No capacity is reserved.");
        var root = state.Delegations.FirstOrDefault(d => d.Key == row.RootKey);
        if (root is not null && Human(session(root.OriginId))) return Reason("human_root", "Root requires human input.", [root]);
        if (row.ParentKey is not null)
        {
            var parent = state.Delegations.FirstOrDefault(d => d.Key == row.ParentKey);
            if (parent is null || parent.WorkState is "failed" or "cancelled" or "recovery_required" or "needs_human")
                return Reason("parent_gate", "Parent cannot authorize execution.", parent is null ? [] : [parent]);
            if (Human(session(parent.TargetId))) return Reason("human_parent", "Parent requires human input.", [parent]);
        }
        foreach (var dependency in row.DependsOn)
        {
            var dep = state.Delegations.FirstOrDefault(d => d.Key == dependency);
            if (dep?.WorkState is "failed" or "cancelled" or "recovery_required")
                return Reason("failed_dependency", $"Dependency failed: {dependency}", [dep]);
            if (dep?.WorkState != "done") return dep is null
                ? new("dependency", $"Waiting for unknown dependency: {dependency}", [dependency])
                : Reason("dependency", $"Waiting for dependency: {dependency}", [dep]);
        }
        var ancestors = new HashSet<string>();
        for (var key = row.ParentKey; key is not null;)
        {
            if (!ancestors.Add(key)) return Reason("ancestry_cycle", "Cyclic assignment ancestry.");
            var ancestor = state.Delegations.FirstOrDefault(d => d.Key == key);
            if (ancestor is null || ancestor.WorkState is "needs_human" or "recovery_required" or "failed" or "cancelled" ||
                Human(session(ancestor.OriginId)) || Human(session(ancestor.TargetId)))
                return Reason("ancestor_gate", "Ancestor cannot authorize execution.", ancestor is null ? [] : [ancestor]);
            key = ancestor.ParentKey;
        }
        var held = state.Delegations.Where(d => d.Key != row.Key && Holds(d) &&
            !Suspended(d, state, active)).ToList();
        // Existing legacy workers also consume execution capacity and have unknown write scope.
        var legacy = state.Delegations.Where(d => d.Protocol != 2 && d.Status is "starting" or "assigned" &&
            !(active?.Invoke(d.TargetId) != true && session(d.TargetId)?.State is "waiting_input" or "blocked" &&
              state.Delegations.Any(child => child.Protocol == 2 && child.OriginId == d.TargetId && !Closed(child)))).ToList();
        var parentReservations = held.Where(d => ancestors.Contains(d.Key)).ToList();
        if (parentReservations.Count > 0 &&
            (held.Count + legacy.Count >= MaxParallel || parentReservations.Any(d => Conflicts(d, row))))
            return Reason("active_parent_reservation",
                "Waiting for parent reservation to yield through an explicit waiting report and completion of its active turn.",
                parentReservations);
        if (held.Count + legacy.Count >= MaxParallel)
            return Reason("capacity", "Waiting for capacity.", held.Concat(legacy));
        var conflicting = held.Where(d => Conflicts(d, row)).Concat(legacy).ToList();
        if (conflicting.Count > 0)
            return Reason("write_conflict", "Waiting for overlapping write ownership.", conflicting);
        return null;
    }
}
