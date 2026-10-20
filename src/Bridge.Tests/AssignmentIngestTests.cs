using Bridge;
using Xunit;
using System.Text.Json;

namespace Bridge.Tests;

public class AssignmentIngestTests
{
    readonly DateTimeOffset now = DateTimeOffset.Parse("2026-10-20T00:00:00Z");
    static SessionFile Session(params OutboxCommand[] commands) => new()
    {
        SessionId = "origin", Outbox = commands.ToList(),
    };
    static OutboxCommand Request(string id) => AssignmentPolicyTests.Request(id);

    [Fact]
    public void MultipleRequestsPersistOnceAcrossRestartAndDoneOrigin()
    {
        var state = new BridgeState();
        var a = Request("a");
        var b = Request("b");
        b.DependsOn = ["a"];
        var session = Session(a, b);
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal(2, state.Delegations.Count);
        Assert.Equal("origin:out:a", state.Delegations[1].DependsOn.Single());
        state = JsonSerializer.Deserialize<BridgeState>(JsonSerializer.Serialize(state, Json.Options), Json.Options)!;
        session.State = "done";
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal(2, state.Delegations.Count);
        Assert.Equal(2, state.OutboxReceipts.Count);
        session.Outbox.Add(Request("late"));
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("rejected", state.OutboxReceipts.Last().Status);
    }

    [Fact]
    public void CollisionIsVisibleOnceAndNeverReplacesOriginal()
    {
        var state = new BridgeState();
        var session = Session(Request("a"));
        AssignmentIngestor.Apply(state, session, now);
        session.Outbox[0].Prompt = "different";
        AssignmentIngestor.Apply(state, session, now);
        var receipt = Assert.Single(state.OutboxReceipts);
        Assert.NotNull(receipt.CollisionHash);
        var firstCollision = receipt.CollisionHash;
        session.Outbox[0].Prompt = "third";
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal(firstCollision, receipt.CollisionHash);
        Assert.Contains("collision", receipt.Error);
        Assert.Equal("Implement bounded task", state.Delegations[0].Prompt);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void InvalidDependencyBatchHasNoPartialRows(bool cycle)
    {
        var a = Request("a");
        var b = Request("b");
        a.DependsOn = [cycle ? "b" : "unknown"];
        if (cycle) b.DependsOn = ["a"];
        var state = new BridgeState();
        AssignmentIngestor.Apply(state, Session(a, b), now);
        Assert.Empty(state.Delegations);
        Assert.Equal(2, state.OutboxReceipts.Count);
        Assert.All(state.OutboxReceipts, r => Assert.Equal("rejected", r.Status));
    }

    [Fact]
    public void OversizedSnapshotAndOversizedTaskRejected()
    {
        var state = new BridgeState();
        AssignmentIngestor.Apply(state, Session(Enumerable.Range(0, 51).Select(i => Request(i.ToString())).ToArray()), now);
        Assert.Empty(state.Delegations);
        Assert.Equal(51, state.OutboxReceipts.Count);
        var big = Request("big");
        big.Points = 3;
        AssignmentIngestor.Apply(state, Session(big), now);
        Assert.Equal("rejected", state.OutboxReceipts.Last().Status);
    }

    [Fact]
    public void DoneHumanSessionsCanReportButNotRequestAndOwnershipIsEnforced()
    {
        var row = new Delegation { Key = "key", Protocol = 2, TargetId = "origin", WorkState = "running" };
        var state = new BridgeState { Delegations = [row] };
        var session = Session(new OutboxCommand { Id = "r", Kind = "report", AssignmentId = "key",
            ReportKind = "done", Summary = "Finished", Evidence = ["tests"], Verification = "passed" });
        session.State = "needs_human";
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("done", row.WorkState);
        Assert.Single(row.Reports);
        session.SessionId = "attacker";
        session.Outbox[0].Id = "attack";
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("rejected", state.OutboxReceipts.Last().Status);
        Assert.Contains("target", state.OutboxReceipts.Last().Error);
        session.Outbox[0].AssignmentId = "unknown";
        session.Outbox[0].Id = "unknown";
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("rejected", state.OutboxReceipts.Last().Status);
    }

    [Theory]
    [InlineData("done", null, true)]
    [InlineData("done", "Review this observation?", true)]
    [InlineData("done", "", false)]
    [InlineData("done", " ", false)]
    [InlineData("needs_human", null, false)]
    [InlineData("needs_human", "", false)]
    [InlineData("needs_human", " ", false)]
    [InlineData("needs_human", "Which environment should be used?", true)]
    public void ReportQuestionIsOptionalExceptForHumanNeeds(string reportKind, string? question, bool accepted)
    {
        var row = new Delegation { Key = "key", Protocol = 2, TargetId = "origin", WorkState = "running" };
        var state = new BridgeState { Delegations = [row] };
        var session = Session(new OutboxCommand { Id = "r", Kind = "report", AssignmentId = "key",
            ReportKind = reportKind, Summary = "Observed result", Evidence = ["tests"],
            Verification = "passed", Question = question });

        AssignmentIngestor.Apply(state, session, now);

        Assert.Equal(accepted ? "accepted" : "rejected", Assert.Single(state.OutboxReceipts).Status);
        Assert.Equal(accepted ? reportKind : "running", row.WorkState);
        if (accepted) Assert.Equal(question, Assert.Single(row.Reports).Question);
        else Assert.Empty(row.Reports);
    }

    [Fact]
    public void TerminalReportsRequireEvidenceAndVerificationAndCancelRetainsOwnership()
    {
        var row = new Delegation { Key = "key", Protocol = 2, TargetId = "origin",
            OriginId = "origin", Mode = "self", WorkState = "running" };
        var state = new BridgeState { Delegations = [row] };
        var session = Session(new OutboxCommand { Id = "r", Kind = "report", AssignmentId = "key",
            ReportKind = "done", Summary = "Finished" });
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("rejected", state.OutboxReceipts.Last().Status);
        session.Outbox = [new() { Id = "cancel", Kind = "cancel", AssignmentId = "key" }];
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("recovery_required", row.WorkState);
        Assert.True(AssignmentPolicy.Holds(row));
    }

    [Fact]
    public void ConflictingDuplicateRequestRejectsWholeBatchAndUnauthorizedCancellationHasReceipt()
    {
        var state = new BridgeState();
        var conflict = Request("a");
        conflict.Prompt = "changed";
        AssignmentIngestor.Apply(state, Session(Request("a"), conflict, Request("b")), now);
        Assert.Empty(state.Delegations);
        Assert.Equal(2, state.OutboxReceipts.Count);
        Assert.All(state.OutboxReceipts, receipt => Assert.Equal("rejected", receipt.Status));
        var row = new Delegation { Key = "held", Protocol = 2, OriginId = "supervisor", TargetId = "origin", WorkState = "running" };
        state.Delegations.Add(row);
        AssignmentIngestor.Apply(state, Session(new OutboxCommand { Id = "cancel", Kind = "cancel", AssignmentId = row.Key }), now);
        Assert.Equal("running", row.WorkState);
        Assert.Contains("origin", state.OutboxReceipts.Last().Error);
    }

    [Fact]
    public void ReportPayloadCannotBeChangedAfterAcceptanceAndHealthUnderstandsExplicitWait()
    {
        var state = new BridgeState
        {
            Delegations = [new() { Protocol = 2, Key = "key", TargetId = "origin", WorkState = "running" }],
        };
        var session = Session(new OutboxCommand { Id = "wait", Kind = "report", AssignmentId = "key",
            ReportKind = "waiting", Summary = "Waiting for children", Evidence = ["observed"] });
        session.State = "waiting_input";
        Assert.Empty(SessionHealth.Issues(session));
        AssignmentIngestor.Apply(state, session, now);
        session.Outbox[0].Summary = "changed";
        session.Outbox[0].Evidence[0] = "changed";
        AssignmentIngestor.Apply(state, session, now);
        Assert.Equal("Waiting for children", state.Delegations[0].Reports.Single().Summary);
        Assert.Equal("observed", state.Delegations[0].Reports.Single().Evidence.Single());
        Assert.Single(state.OutboxReceipts);
        Assert.Contains("collision", state.OutboxReceipts[0].Error);
    }

    [Fact]
    public void BlockedUngrantableSelfRowCannotReportDoneToBypassDependencies()
    {
        var row = new Delegation { Key = "self", Protocol = 2, TargetId = "origin",
            OriginId = "origin", Mode = "self", Status = "queued", WorkState = "blocked" };
        var state = new BridgeState { Delegations = [row] };
        AssignmentIngestor.Apply(state, Session(new OutboxCommand { Id = "done", Kind = "report",
            AssignmentId = row.Key, ReportKind = "done", Summary = "Claimed done",
            Evidence = ["claimed artifact"], Verification = "claimed verification" }), now);
        Assert.Equal("blocked", row.WorkState);
        Assert.Empty(row.Reports);
        Assert.Contains("grant", state.OutboxReceipts.Single().Error);
    }

    [Fact]
    public void DelimitersInStableIdsCannotSilentlyDropAnotherReportNotification()
    {
        var first = new Delegation { Key = "supervisor:out:a", Protocol = 2, OriginId = "supervisor",
            TargetId = "worker1", WorkState = "running", Reports = [new() { Id = "b:c", Kind = "progress" }] };
        var second = new Delegation { Key = "supervisor:out:a:b", Protocol = 2, OriginId = "supervisor",
            TargetId = "origin", WorkState = "running" };
        var state = new BridgeState { Delegations = [first, second] };
        AssignmentIngestor.Apply(state, Session(new OutboxCommand { Id = "c", Kind = "report",
            AssignmentId = second.Key, ReportKind = "progress", Summary = "Observed progress" }), now);
        Assert.Empty(second.Reports);
        Assert.Contains("collision", state.OutboxReceipts.Single().Error);
    }
}
