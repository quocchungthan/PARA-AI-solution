namespace Bridge;

// Applies one snapshot to the canonical ledger. Caller persists it atomically before
// publishing any inbox messages; no execution or secondary assignment database lives here.
public static class AssignmentIngestor
{
    public static void Apply(BridgeState state, SessionFile session, DateTimeOffset now,
        Func<string, SessionFile?>? lookup = null, Func<string, bool>? active = null)
    {
        var fresh = new List<OutboxCommand>();
        string? batchError = null;
        foreach (var group in session.Outbox.GroupBy(c => c.Id ?? "", StringComparer.Ordinal))
        {
            var command = group.First();
            var hash = AssignmentPolicy.Hash(command);
            var receipt = state.OutboxReceipts.FirstOrDefault(r =>
                r.SessionId == session.SessionId && r.CommandId == (command.Id ?? ""));
            if (receipt is not null)
            {
                if (group.Any(c => AssignmentPolicy.Hash(c) != receipt.PayloadHash) && receipt.CollisionHash is null)
                {
                    receipt.CollisionHash = group.Select(AssignmentPolicy.Hash).First(h => h != receipt.PayloadHash);
                    receipt.Error = (receipt.Error is null ? "" : receipt.Error + " ") +
                        "Immutable outbox ID collision: changed payload ignored; use a new command ID.";
                }
                continue;
            }
            if (group.Select(AssignmentPolicy.Hash).Distinct().Count() > 1)
            {
                Record(state, session, command, "rejected", error: "Duplicate command ID with conflicting payloads.");
                if (group.Any(c => c.Kind == "request")) batchError = "Conflicting request IDs invalidate the request batch.";
                continue;
            }
            fresh.Add(command);
        }
        if (session.Outbox.Count > 50)
        {
            foreach (var c in fresh)
                Record(state, session, c, "rejected", error: "Outbox snapshot exceeds 50 commands.");
            return;
        }
        var requests = fresh.Where(c => c.Kind == "request").ToList();
        if (requests.Count > 0)
        {
            var error = batchError ?? AssignmentPolicy.ValidateBatch(session, requests, state);
            foreach (var c in requests)
            {
                if (error is not null)
                {
                    Record(state, session, c, "rejected", error: error);
                    continue;
                }
                var parent = state.Delegations.FirstOrDefault(d => d.Key == session.Work);
                var key = AssignmentPolicy.Key(session.SessionId, c.Id);
                state.Delegations.Add(new Delegation
                {
                    Key = key, Protocol = 2, OriginId = session.SessionId,
                    TargetId = c.Mode == "self" ? session.SessionId : "",
                    RootKey = parent?.RootKey ?? parent?.Key ?? key, ParentKey = parent?.Key,
                    Mode = c.Mode, Title = c.Title, Prompt = c.Prompt, Points = c.Points, Agent = c.Agent,
                    Acceptance = c.Acceptance.ToList(),
                    DependsOn = c.DependsOn.Select(id => AssignmentPolicy.Key(session.SessionId, id)).Distinct().ToList(),
                    Writes = c.Writes.Select(AssignmentPolicy.NormalizePath).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                    AccessMode = c.AccessMode,
                    Reads = c.Reads?.Select(AssignmentPolicy.NormalizePath).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                    ApprovalRef = c.ApprovalRef, WorkState = "queued", Status = "queued",
                    CreateSession = c.Mode == "new", WantResult = true,
                    PayloadHash = AssignmentPolicy.Hash(c), CreatedAt = now.ToString("o"),
                });
                Record(state, session, c, "accepted", key);
            }
        }
        foreach (var c in fresh.Where(c => c.Kind != "request"))
        {
            var row = state.Delegations.FirstOrDefault(d => d.Protocol == 2 && d.Key == c.AssignmentId);
            var error = string.IsNullOrWhiteSpace(c.Id) ? "Command ID is required." :
                row is null ? "Unknown assignment." :
                c.Kind == "report" ? ValidateReport(session, row, c, state, lookup, active) :
                c.Kind == "cancel" ? row.OriginId != session.SessionId ? "Only the origin may cancel." :
                    AssignmentPolicy.Closed(row) ? "Assignment is already terminal." : null :
                "Kind must be request, report or cancel.";
            if (error is not null)
            {
                Record(state, session, c, "rejected", c.AssignmentId, error);
                continue;
            }
            if (c.Kind == "cancel")
            {
                // Once attempted, absence of an active turn does not prove cessation.
                // Keep held ownership until a human reconciles the uncertain worker.
                row!.WorkState = row.Status != "queued" || row.TargetId.Length > 0 && row.Mode == "new" ||
                    row.Attempts > 0 || row.RecoveryAttempts > 0 ? "recovery_required" : "cancelled";
                row.LastError = row.WorkState == "recovery_required"
                    ? "Cancellation requested after grant; worker cessation requires human reconciliation."
                    : "Cancelled by origin before grant.";
            }
            else
            {
                row!.Reports.Add(new AssignmentReport
                {
                    Id = c.Id, Kind = c.ReportKind!, Summary = c.Summary!,
                    Evidence = c.Evidence.ToList(), Verification = c.Verification,
                    Question = c.Question, CreatedAt = now.ToString("o"),
                });
                row.WorkState = c.ReportKind == "progress" ? "running" : c.ReportKind;
                row.NextAttemptAt = null;
                row.LastError = null;
            }
            row.Status = row.WorkState!;
            Record(state, session, c, "accepted", row.Key);
        }
    }

    static string? ValidateReport(SessionFile sender, Delegation row, OutboxCommand c, BridgeState state,
        Func<string, SessionFile?>? lookup, Func<string, bool>? active)
    {
        if (row.TargetId != sender.SessionId) return "Report sender is not the assignment target.";
        if (AssignmentPolicy.Closed(row)) return "Assignment is already terminal.";
        if (row.WorkState == "queued" || row.Status == "queued") return "Assignment has no running grant.";
        if (c.ReportKind is not ("progress" or "waiting" or "blocked" or "needs_human" or "done" or "failed"))
            return "Invalid reportKind.";
        if (string.IsNullOrWhiteSpace(c.Summary) || c.Evidence is null || c.Evidence.Any(string.IsNullOrWhiteSpace))
            return "Report summary and valid evidence list are required.";
        if (c.ReportKind is "done" or "failed" &&
            (c.Evidence.Count == 0 || string.IsNullOrWhiteSpace(c.Verification)))
            return "Terminal reports require meaningful evidence and verification (or 'not run: reason').";
        if (c.ReportKind == "needs_human" && string.IsNullOrWhiteSpace(c.Question))
            return "Human report requires a question.";
        if (state.Delegations.Any(other => other.Protocol == 2 && other.OriginId == row.OriginId &&
            other.Reports.Any(report => $"report:{other.Key}:{report.Id}" == $"report:{row.Key}:{c.Id}")))
            return "Report notification ID collision; use a different stable report command ID.";
        if (c.ReportKind == "done" && state.Delegations.Any(d => d.Protocol == 2 &&
            d.ParentKey == row.Key && !AssignmentPolicy.Closed(d)))
            return "Cannot complete a supervisor with unfinished children.";
        if (c.ReportKind == "progress" && row.WorkState != "running")
        {
            var gate = AssignmentPolicy.Gate(row, state, id => id == sender.SessionId ? sender : lookup?.Invoke(id), active);
            if (gate is not null) return "Cannot reacquire running grant: " + gate;
            if (row.WorkState == "recovery_required") return "Human reconciliation is required before resuming.";
        }
        return null;
    }

    static void Record(BridgeState state, SessionFile session, OutboxCommand command, string status,
        string? assignment = null, string? error = null) =>
        state.OutboxReceipts.Add(new OutboxReceipt
        {
            SessionId = session.SessionId, CommandId = command.Id ?? "", PayloadHash = AssignmentPolicy.Hash(command),
            Status = status, AssignmentId = assignment, Error = error,
        });
}
