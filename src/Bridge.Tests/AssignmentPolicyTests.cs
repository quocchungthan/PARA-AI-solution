using Bridge;
using Xunit;

namespace Bridge.Tests;

public class AssignmentPolicyTests
{
    public static OutboxCommand Request(string id = "a", string mode = "new", params string[] writes) => new()
    {
        Id = id, Kind = "request", Title = id, Prompt = "Implement bounded task", Points = 2, Mode = mode,
        Acceptance = ["Tests pass"], ApprovalRef = "Approved user scope", Writes = writes.ToList(),
    };
    public static SessionFile Origin() => new() { SessionId = "origin", UpdatedAt = DateTimeOffset.UtcNow.ToString("o") };

    [Fact]
    public void BatchRejectsLargeEmptyUnknownAndCyclicRequests()
    {
        var origin = Origin();
        var state = new BridgeState();
        var a = Request();
        Assert.Null(AssignmentPolicy.ValidateBatch(origin, [a], state));
        a.Points = 3;
        Assert.NotNull(AssignmentPolicy.ValidateBatch(origin, [a], state));
        a.Points = 2;
        a.Acceptance.Clear();
        Assert.NotNull(AssignmentPolicy.ValidateBatch(origin, [a], state));
        a.Acceptance.Add("Pass");
        a.DependsOn = ["missing"];
        Assert.Contains("Unknown", AssignmentPolicy.ValidateBatch(origin, [a], state));
        var b = Request("b");
        a.DependsOn = ["b"];
        b.DependsOn = ["a"];
        Assert.Contains("cycle", AssignmentPolicy.ValidateBatch(origin, [a, b], state));
    }

    [Theory]
    [InlineData("../file")]
    [InlineData("src/../file")]
    [InlineData("/etc")]
    [InlineData("C:\\file")]
    [InlineData("src/**")]
    [InlineData("src//a")]
    [InlineData("src/./a")]
    public void RejectsUnsafePaths(string path) =>
        Assert.Throws<ArgumentException>(() => AssignmentPolicy.NormalizePath(path));

    [Fact]
    public void PathsAndCapacityIncludeUncertainOwnership()
    {
        Assert.True(AssignmentPolicy.Overlaps(["SRC/Bridge"], ["src/bridge/models.cs"]));
        Assert.False(AssignmentPolicy.Overlaps(["src/Bridge"], ["src/Bridge.Tests"]));
        Assert.True(AssignmentPolicy.Overlaps([], ["anything"]));
        var state = new BridgeState { Delegations = [new() { Key = "held", Protocol = 2,
            WorkState = "recovery_required", Writes = ["SRC"] }] };
        var row = new Delegation { Key = "next", Protocol = 2, Writes = ["src/file"], OriginId = "origin" };
        Assert.Contains("ownership", AssignmentPolicy.Gate(row, state, _ => Origin()));
        state.Delegations[0].Writes = ["other"];
        Assert.Null(AssignmentPolicy.Gate(row, state, _ => Origin()));
        var human = Origin();
        human.State = "needs_human";
        Assert.Contains("human", AssignmentPolicy.Gate(row, state, _ => human));
    }

    [Fact]
    public void ParentRequiresOwnedRunningWorkAndContainedPaths()
    {
        var origin = Origin();
        origin.Work = "parent";
        var parent = new Delegation { Key = "parent", RootKey = "parent", Protocol = 2,
            TargetId = "other", WorkState = "running", Writes = ["src"], ApprovalRef = "Approved user scope" };
        var state = new BridgeState { Delegations = [parent] };
        Assert.NotNull(AssignmentPolicy.ValidateBatch(origin, [Request()], state));
        parent.TargetId = origin.SessionId;
        Assert.NotNull(AssignmentPolicy.ValidateBatch(origin, [Request("a", "new", "web")], state));
        Assert.Null(AssignmentPolicy.ValidateBatch(origin, [Request("a", "new", "src/file")], state));
        parent.ApprovalRef = "A different approval";
        Assert.Contains("approvalRef", AssignmentPolicy.ValidateBatch(origin, [Request("a", "new", "src/file")], state));
        parent.ApprovalRef = "Approved user scope";
        parent.ParentKey = "parent";
        Assert.Contains("Cyclic", AssignmentPolicy.ValidateBatch(origin, [Request()], state));
    }

    [Fact]
    public void ChildLimitIsSeparateAndSuspensionRequiresExplicitWaitWithoutActiveTurn()
    {
        var state = new BridgeState();
        var requests = Enumerable.Range(0, 13).Select(i => Request(i.ToString(), "new", i.ToString())).ToList();
        Assert.Contains("limit", AssignmentPolicy.ValidateBatch(Origin(), requests, state));
        Assert.Null(AssignmentPolicy.ValidateBatch(Origin(),
            Enumerable.Range(0, 13).Select(i => Request(i.ToString(), "self", i.ToString())).ToList(), state));
        var parent = new Delegation { Key = "parent", TargetId = "origin", Protocol = 2, WorkState = "waiting" };
        state.Delegations.Add(parent);
        state.Delegations.Add(new() { Protocol = 2, Key = "child", ParentKey = "parent" });
        Assert.False(AssignmentPolicy.Suspended(parent, state));
        parent.Reports.Add(new() { Id = "wait", Kind = "waiting" });
        Assert.True(AssignmentPolicy.Suspended(parent, state, _ => false));
        Assert.False(AssignmentPolicy.Suspended(parent, state, _ => true));
    }

    [Fact]
    public void OldSelfGrantsDoNotReappearAsOwnersWhenSameSessionRunsAnotherTurn()
    {
        var state = new BridgeState { Delegations = [new() { Protocol = 2, Mode = "self", Key = "old",
            TargetId = "origin", WorkState = "done", Writes = ["src"] }] };
        var row = new Delegation { Protocol = 2, Key = "current", OriginId = "origin", TargetId = "origin",
            WorkState = "waiting", Writes = ["src"] };
        Assert.Null(AssignmentPolicy.Gate(row, state, _ => Origin(), _ => true));
    }

    [Fact]
    public void ReaderConflictsAndChildScopesPreserveLegacySafety()
    {
        var reader = new Delegation { AccessMode = "read_only", Reads = ["docs"] };
        var another = new Delegation { AccessMode = "read_only", Reads = [] };
        Assert.False(AssignmentPolicy.Conflicts(reader, another));
        Assert.True(AssignmentPolicy.Conflicts(reader, new() { Writes = [] }));
        Assert.True(AssignmentPolicy.Conflicts(reader, new() { Writes = ["DOCS/a"] }));
        Assert.False(AssignmentPolicy.Conflicts(reader, new() { Writes = ["src"] }));
        var origin = Origin();
        origin.Work = "parent";
        reader.Key = "parent";
        reader.Protocol = 2;
        reader.TargetId = origin.SessionId;
        reader.WorkState = "running";
        reader.ApprovalRef = "Approved user scope";
        var state = new BridgeState { Delegations = [reader] };
        var child = Request();
        Assert.Contains("cannot create writers", AssignmentPolicy.ValidateBatch(origin, [child], state));
        child.AccessMode = "read_only";
        child.Reads = ["docs/a"];
        Assert.Null(AssignmentPolicy.ValidateBatch(origin, [child], state));
        child.Reads = [];
        Assert.Contains("Child Reads", AssignmentPolicy.ValidateBatch(origin, [child], state));
        child.Reads = ["../escape"];
        Assert.Contains("Invalid", AssignmentPolicy.ValidateBatch(origin, [child], state));
        child.Reads = ["docs"];
        child.Writes = ["docs"];
        Assert.Contains("cannot declare Writes", AssignmentPolicy.ValidateBatch(origin, [child], state));
        child.Writes = [];
        child.AccessMode = "invalid";
        Assert.Contains("AccessMode", AssignmentPolicy.ValidateBatch(origin, [child], state));
    }
}
