using Bridge;
using Xunit;

namespace Bridge.Tests;

public class AssignmentSchedulingTests
{
    static Delegation Row(string key, string workState = "queued", params string[] writes) => new()
    {
        Protocol = 2, Key = key, OriginId = "origin", TargetId = key + "-worker",
        WorkState = workState, Status = workState == "queued" ? "queued" : "assigned",
        Writes = writes.ToList(), Mode = "new",
    };
    static SessionFile? Session(string _) => null;

    [Fact]
    public void ExclusiveDiskRootMapExplains30sQueueUsingSameGate()
    {
        var held = Row("origin:out:disk-root-map", "running");
        held.Title = "Map disk roots";
        var queued = Row("origin:out:30s", "queued", "src/30s");
        var state = new BridgeState { Delegations = [held, queued] };
        var reason = AssignmentPolicy.DescribeScheduling(queued, state, Session);
        Assert.Equal("write_conflict", reason.Code);
        Assert.Equal(new[] { held.Key }, reason.BlockingAssignmentIds);
        Assert.Contains(held.Key, reason.Summary);
        Assert.Contains("Map disk roots", reason.Summary);
        Assert.Contains("repository-exclusive Writes=[]", reason.Summary);
        Assert.Equal(AssignmentPolicy.Gate(queued, state, Session), reason.Summary);
        Assert.Equal("running", held.WorkState); // Diagnostics do not mutate ownership.
    }

    [Theory]
    [InlineData("queued", "dependency")]
    [InlineData("failed", "failed_dependency")]
    [InlineData("recovery_required", "failed_dependency")]
    public void DependencyReasonIncludesIdAndTitle(string workState, string code)
    {
        var prerequisite = Row("prerequisite", workState, "a");
        prerequisite.Title = "Required evidence";
        var queued = Row("next", "queued", "b");
        queued.DependsOn = [prerequisite.Key];
        var state = new BridgeState { Delegations = [prerequisite, queued] };
        var reason = AssignmentPolicy.DescribeScheduling(queued, state, Session);
        Assert.Equal(code, reason.Code);
        Assert.Equal(new[] { prerequisite.Key }, reason.BlockingAssignmentIds);
        Assert.Contains("Required evidence", reason.Summary);
        Assert.Equal(AssignmentPolicy.GrantReason(queued, state, Session)!.Summary, reason.Summary);
    }

    [Fact]
    public void SelfGrantDoesNotImplySdkExecutionAndWaitingRecoveryAreExplicit()
    {
        var row = Row("self", "running");
        row.Mode = "self";
        var state = new BridgeState { Delegations = [row] };
        var reason = AssignmentPolicy.DescribeScheduling(row, state, Session);
        Assert.Equal("self_granted", reason.Code);
        Assert.Contains("not automatically executing", reason.Summary);
        row.WorkState = "waiting";
        row.Reports = [new() { Kind = "waiting", Summary = "Waiting for human reply" }];
        Assert.Equal("explicit_waiting", AssignmentPolicy.DescribeScheduling(row, state, Session).Code);
        row.WorkState = "recovery_required";
        row.LastError = "Cessation uncertain";
        Assert.Equal("Cessation uncertain", AssignmentPolicy.DescribeScheduling(row, state, Session).Summary);
    }

    [Fact]
    public void ActiveParentReservationUsesSameSuspensionAndCapacityRules()
    {
        var parent = Row("parent", "running");
        var child = Row("child", "queued", "src");
        child.ParentKey = parent.Key;
        var state = new BridgeState { Delegations = [parent, child] };
        Assert.Equal("active_parent_reservation", AssignmentPolicy.DescribeScheduling(child, state, Session).Code);
        parent.WorkState = "waiting";
        parent.Reports = [new() { Kind = "waiting" }];
        Assert.Equal("active_parent_reservation",
            AssignmentPolicy.DescribeScheduling(child, state, Session, _ => true).Code);
        Assert.Equal("ready", AssignmentPolicy.DescribeScheduling(child, state, Session, _ => false).Code);
        Assert.Null(AssignmentPolicy.Gate(child, state, Session, _ => false));
    }

    [Fact]
    public void HumanAndCapacityReasonsIdentifyCanonicalBlockers()
    {
        var queued = Row("queued", "queued", "next");
        var root = Row("root", "running", "root");
        root.OriginId = "root-origin";
        queued.RootKey = root.Key;
        var state = new BridgeState { Delegations = [root, queued] };
        SessionFile? Lookup(string id) => id == "root-origin" ? new() { State = "needs_human" } : null;
        var human = AssignmentPolicy.DescribeScheduling(queued, state, Lookup);
        Assert.Equal("human_root", human.Code);
        Assert.Contains(root.Key, human.BlockingAssignmentIds);
        state.Delegations.Add(Row("second", "recovery_required", "other"));
        var capacity = AssignmentPolicy.DescribeScheduling(queued, state, Session);
        Assert.Equal("capacity", capacity.Code);
        Assert.Equal(2, capacity.BlockingAssignmentIds.Count);
        Assert.Equal(capacity.Summary, AssignmentPolicy.Gate(queued, state, Session));
    }
}
