using System.Text.Json;

namespace Bridge;

public partial class Scanner
{
    async Task ProcessAssignmentsAsync(BridgeState state, List<SessionFile> sessions)
    {
        foreach (var session in sessions.Where(s => !s.Discovered))
            AssignmentIngestor.Apply(state, session, _now(), LoadSession, _turns.ContainsKey);
        Save(state); // Requests, immutable reports and rejections all precede inbox publication.

        foreach (var row in state.Delegations.Where(d => d.Protocol == 2))
        {
            if (row.WorkState == "queued")
            {
                var gate = AssignmentPolicy.GrantReason(row, state, LoadSession, _turns.ContainsKey);
                if (gate?.Code == "failed_dependency")
                {
                    row.WorkState = "blocked";
                    row.LastError = gate.Summary;
                    row.Reports.Add(new AssignmentReport
                    {
                        Id = "bridge-dependency", Kind = "blocked", Summary = gate.Summary,
                        Evidence = row.DependsOn.ToList(), CreatedAt = Now(),
                    });
                    Save(state);
                }
                else if (gate is null)
                {
                    if (row.Mode == "new")
                    {
                        row.TargetId = Guid.NewGuid().ToString();
                        row.Prompt = AssignmentPrompt(row, state);
                    }
                    // A self grant is ledger-only: no enqueue, resume, or injected turn.
                    row.WorkState = "running";
                    row.Status = "assigned";
                    row.LastAttemptAt = Now();
                    Save(state); // Identity and complete prompt before enqueue (crash-safe).
                }
            }
            if (row.Mode == "new" && row.TargetId.Length > 0 && row.Status != "queued" &&
                !AssignmentPolicy.Closed(row) && row.WorkState != "recovery_required")
            {
                var initialId = MessageId("assignment", row.Key);
                await QueueAsync(row.TargetId, initialId, row.Prompt!, row.OriginId, true, row.Agent);
                var initial = Message(row.TargetId, initialId)!;
                row.Attempts = initial.Attempts;
                if (initial.Status == "failed")
                    RequireAssignmentRecovery(row, initial.LastError ?? "Initial delivery exhausted retries.");
                else if (row.WorkState == "running" && initial.Status == "delivered" &&
                    !_turns.ContainsKey(row.TargetId) && !AssignmentPolicy.Human(LoadSession(row.TargetId)) &&
                    AssignmentPolicy.Gate(row, state, LoadSession, _turns.ContainsKey) is null)
                {
                    // An externally owned session is attended, even if it has not yet
                    // published a file or refreshed a stale working state.
                    if (!_isLive(row.TargetId))
                    {
                        var last = _lastActivity(row.TargetId);
                        var delivered = DateTimeOffset.TryParse(initial.DeliveredAt, out var stamp) ? stamp : _now();
                        var reportAt = row.Reports.LastOrDefault()?.CreatedAt;
                        var reported = DateTimeOffset.TryParse(reportAt, out var reportStamp) ? reportStamp : delivered;
                        var recent = new[] { delivered, reported, last ?? DateTimeOffset.MinValue }.Max();
                        if (_now() - recent >= Inspector.SilentAfter)
                            await RecoverAssignmentAsync(state, row);
                    }
                }
            }
            // Every scan reconstructs notifications from immutable full reports. Queue publication
            // is deliberately independent of creator state; dispatch retains done/human gates.
            foreach (var report in row.Reports)
                if (row.OriginId != row.TargetId)
                    await QueueAsync(row.OriginId, MessageId("report", row.Key + ":" + report.Id),
                        $"Assignment {row.Key} report from {row.TargetId}. This is not completion of your supervisor task. " +
                        "Do not publish externally. If waiting, reacquire a running grant via a progress report before writing.\n" +
                        JsonSerializer.Serialize(report, Json.Options), row.TargetId);
        }
        Save(state);
    }

    string AssignmentPrompt(Delegation row, BridgeState state)
    {
        var dependencies = row.DependsOn.Select(key =>
        {
            var dep = state.Delegations.First(d => d.Key == key);
            return $"{key}: {string.Join("\n", dep.Reports.Select(r => $"{r.Kind}: {r.Summary}; evidence: {string.Join("; ", r.Evidence)}; verification: {r.Verification}"))}";
        });
        return $"""
            PARA assignment {row.Key}, protocol 2. Your session id is {row.TargetId}.
            Creator supervisor: {row.OriginId}. Parent: {row.ParentKey ?? "(none)"}. Root: {row.RootKey}.
            Set session work to "{row.Key}". This is an approved bounded {row.Points}-point assignment.
            Approval reference (cooperative provenance, not hard permission enforcement): {row.ApprovalRef}
            Title: {row.Title}
            Task:
            {row.Prompt}
            Acceptance:
            {string.Join("\n", row.Acceptance)}
            Writes (repository-relative exclusive scope; an empty list means repository-exclusive):
            {JsonSerializer.Serialize(row.Writes, Json.Options)}
            Access mode: {row.AccessMode ?? "write (legacy default)"}
            Reads: {JsonSerializer.Serialize(row.Reads, Json.Options)}
            If access mode is read_only, Writes=[] means no source writes; Reads=[] or null means whole-repository read access.
            This is cooperative scope, not a filesystem sandbox. Never bypass protected-path permission denials.
            Dependency reports:
            {string.Join("\n", dependencies)}
            Follow para-session-protocol. Check the read-only Bridge ledger for your running grant before writes.
            If decomposing, child requests must inherit this approvalRef and remain within these Writes.
            Yield with an explicit waiting report before children can use your write/capacity reservation.
            Publish immutable outbox commands (at most 50 per snapshot), never edit old command IDs:
            {JsonSerializer.Serialize(new OutboxCommand { Id = "stable-report-id", Kind = "report", AssignmentId = row.Key,
                ReportKind = "progress|waiting|blocked|needs_human|done|failed", Summary = "meaningful summary",
                Evidence = ["artifact or test"], Verification = "passed, or not run: reason", Question = "required for needs_human" }, Json.Options)}
            Only explicit done/failed reports close this assignment, with evidence and verification.
            Session state/result is NOT an assignment report. Never automatically commit, push, open a PR, merge, or close external tasks.
            """;
    }

    async Task RecoverAssignmentAsync(BridgeState state, Delegation row)
    {
        if (_runtime is null || row.WorkState != "running") return;
        if (row.RecoveryAttempts > 0)
        {
            // Reconstruct the persisted-before-enqueue recovery window too.
            await QueueAssignmentRepairAsync(row);
            var previous = Message(row.TargetId, MessageId("assignment-recovery", row.Key + ":" + row.RecoveryAttempts));
            var superseded = previous is not null && ReportSupersedes(row, previous);
            if (!superseded && previous is not null && previous.Status is not ("delivered" or "failed")) return;
            if (!superseded && previous?.Status == "failed")
            {
                RequireAssignmentRecovery(row, previous.LastError ?? "Repair delivery exhausted retries.");
                return;
            }
            if (!RetryPolicy.IsDue(row.NextAttemptAt, _now())) return;
        }
        if (row.RecoveryAttempts >= 3 || row.CreateSession != true || string.IsNullOrWhiteSpace(row.Prompt))
        {
            RequireAssignmentRecovery(row, "Recovery exhausted or saved new-session identity/prompt missing; human reconciliation required.");
            return;
        }
        row.RecoveryAttempts++;
        row.NextAttemptAt = _now().AddMinutes(10).ToString("o");
        Save(state);
        await QueueAssignmentRepairAsync(row);
    }

    Task QueueAssignmentRepairAsync(Delegation row) =>
        QueueAsync(row.TargetId, MessageId("assignment-recovery", row.Key + ":" + row.RecoveryAttempts),
            "Repair this interrupted assignment using the SAME identity. Check completed side effects first. " +
            "Publish an explicit v2 report; do not reuse an old session Result.\n\n" + row.Prompt,
            createSession: true, agent: row.Agent);

    static void RequireAssignmentRecovery(Delegation row, string error)
    {
        row.WorkState = "recovery_required";
        row.Status = "recovery_required";
        row.LastError = error;
        row.NextAttemptAt = null;
    }

    bool AssignmentDispatchAllowed(BridgeState state, string id, InboxMessage message, SessionFile? session)
    {
        if (message.From != "user" && message.Id.StartsWith("report:", StringComparison.Ordinal) &&
            (session?.State == "done" || AssignmentPolicy.Human(session))) return false;
        if (!message.Id.StartsWith("assignment:", StringComparison.Ordinal) &&
            !message.Id.StartsWith("assignment-recovery:", StringComparison.Ordinal)) return true;
        var row = state.Delegations.FirstOrDefault(d => d.Protocol == 2 && d.TargetId == id &&
            (message.Id == MessageId("assignment", d.Key) ||
             message.Id.StartsWith(MessageId("assignment-recovery", d.Key + ":"), StringComparison.Ordinal)));
        if (row is not null && message.Id.StartsWith("assignment-recovery:", StringComparison.Ordinal) &&
            ReportSupersedes(row, message))
            return false; // An explicit report supersedes queued repair prompts, not a new wake.
        return row is not null && row.Mode == "new" && row.WorkState == "running" &&
            AssignmentPolicy.Gate(row, state, LoadSession, _turns.ContainsKey) is null;
    }

    static bool ReportSupersedes(Delegation row, InboxMessage message) =>
        DateTimeOffset.TryParse(message.CreatedAt, out var queuedAt) &&
        row.Reports.Any(r => DateTimeOffset.TryParse(r.CreatedAt, out var reportedAt) && reportedAt >= queuedAt);
}
