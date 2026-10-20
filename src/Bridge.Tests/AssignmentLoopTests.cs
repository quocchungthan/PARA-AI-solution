using System.Collections.Concurrent;
using Bridge;
using GitHub.Copilot;
using Xunit;

namespace Bridge.Tests;

public class AssignmentLoopTests
{
    [Fact]
    public async Task NewGrantsRespectCapacityCaseInsensitiveFilesAndDependencies()
    {
        using var h = new Harness();
        var origin = h.Origin(
            Request("a", "new", "src/a"),
            Request("b", "new", "SRC/A/file"),
            Request("c", "new", "src/c"),
            Request("d", "new", "src/d"));
        await h.Tick();
        Assert.Equal(2, h.State.Delegations.Count(d => d.WorkState == "running"));
        Assert.Equal("queued", h.Row(origin, "b").WorkState);
        Assert.Equal("queued", h.Row(origin, "d").WorkState);
        var target = h.Row(origin, "a").TargetId;
        h.Report(target, "done", "done", h.Row(origin, "a").Key);
        await h.Tick();
        Assert.Equal("running", h.Row(origin, "b").WorkState);
        Assert.Equal(2, h.State.Delegations.Count(d => d.WorkState == "running"));
        Assert.Contains("Acceptance:", h.Inbox(target).Messages.Single().Prompt);
        Assert.Contains("Creator supervisor:", h.Inbox(target).Messages.Single().Prompt);
    }

    [Fact]
    public async Task NewGrantCreatesTheSessionWithItsSelectedInstalledRole()
    {
        using var h = new Harness();
        var request = Request("review", "new", "src/review");
        request.Agent = "reviewer";
        h.Origin(request);

        await h.Tick();

        Assert.Equal("reviewer", Assert.Single(h.Runtime.CreatedAgents));
    }

    [Fact]
    public async Task DependenciesWaitForExplicitDoneAndFailedDependenciesBlockWithoutChurn()
    {
        using var h = new Harness();
        var a = Request("a", "new", "a");
        var b = Request("b", "new", "b");
        b.DependsOn = ["a"];
        var origin = h.Origin(a, b);
        await h.Tick();
        var target = h.Row(origin, "a").TargetId;
        h.Write(new() { SessionId = target, State = "done", Result = "Old result is NOT a report", UpdatedAt = h.Clock.ToString("o") });
        await h.Tick();
        Assert.Equal("running", h.Row(origin, "a").WorkState);
        Assert.Equal("queued", h.Row(origin, "b").WorkState);
        h.Report(target, "failed", "failed", h.Row(origin, "a").Key);
        await h.Tick();
        var blocked = h.Row(origin, "b");
        Assert.Equal("blocked", blocked.WorkState);
        Assert.False(AssignmentPolicy.Holds(blocked));
        Assert.Single(blocked.Reports);
        await h.Tick(); // Drain the second, distinct failed-dependency notification.
        var calls = h.Runtime.Sends.Count;
        await h.Tick();
        await h.Tick();
        Assert.Single(h.Row(origin, "b").Reports);
        Assert.Equal(calls, h.Runtime.Sends.Count);
    }

    [Fact]
    public async Task SelfIsLedgerOnlyAndDoesNotPoisonLegacyGraphOrCaps()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("self", "self", "src"));
        h.Live.Add(origin);
        await h.Tick();
        Assert.Equal("queued", h.Row(origin, "self").WorkState);
        // Preserve and close an already granted pre-upgrade self assignment.
        var saved = h.State;
        saved.Delegations.Single().WorkState = "running";
        saved.Delegations.Single().Status = "assigned";
        h.Save(saved);
        await h.Tick();
        Assert.Equal("running", h.Row(origin, "self").WorkState);
        Assert.Equal(origin, h.Row(origin, "self").TargetId);
        Assert.Empty(h.Runtime.Sends);
        Assert.Empty(h.Inbox(origin).Messages);
        h.Report(origin, "done", "done", h.Row(origin, "self").Key);
        await h.Tick();
        Assert.Equal("done", h.Row(origin, "self").WorkState);
        Assert.Empty(h.Inbox(origin).Messages);
        var session = h.Session(origin);
        session.State = "waiting_input";
        session.Question = "Awaiting legacy helper";
        session.Outbox = [];
        session.Handoff = new() { Id = "legacy", Prompt = "Approved legacy bounded work" };
        h.Write(session);
        await h.Tick();
        Assert.DoesNotContain(h.State.Delegations, d => d.Status == "limit_reached");
        Assert.Contains(h.State.Delegations, d => d.Protocol is null && d.Status == "starting");
    }

    [Fact]
    public async Task ManagedWorkChecksHumanCapacityAndPathsBeforeGrant()
    {
        using var h = new Harness();
        var owner = h.Origin(Request("a", "new", "SRC"));
        var claimant = h.Origin(Request("b", "new", "src/file"));
        await h.Tick();
        Assert.Equal(1, h.State.Delegations.Count(d => d.WorkState == "running"));
        Assert.Equal(1, h.State.Delegations.Count(d => d.WorkState == "queued"));
        var held = h.State.Delegations.Single(d => d.WorkState == "running");
        var pending = h.State.Delegations.Single(d => d.WorkState == "queued");
        h.Report(held.TargetId, "done", "done", held.Key);
        var human = h.Session(pending.OriginId);
        human.State = "needs_human";
        human.Needs = [new() { Resolver = "human", Text = "Decision" }];
        human.Question = "Continue?";
        h.Write(human);
        await h.Tick();
        Assert.Equal("queued", h.State.Delegations.Single(d => d.Key == pending.Key).WorkState);
        Assert.Single(h.Runtime.Creates);
    }

    [Fact]
    public async Task AllReportKindsAreImmutableAndNotifiedOnceIncludingDoneCreatorAcrossRestart()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "a"));
        await h.Tick();
        var row = h.Row(origin, "a");
        foreach (var kind in new[] { "progress", "waiting", "blocked", "done" })
        {
            h.Report(row.TargetId, kind, kind, row.Key);
            await h.Tick();
            Assert.Equal(kind == "progress" ? "running" : kind, h.Row(origin, "a").WorkState);
        }
        var notifications = h.Inbox(origin).Messages.Where(m => m.Id.StartsWith("report:")).ToList();
        Assert.Equal(4, notifications.Count);
        Assert.Contains(notifications, m => m.Id == $"report:{row.Key}:done");
        var originSession = h.Session(origin);
        originSession.State = "done";
        originSession.Result = "Creator finished CLI turn";
        h.Write(originSession);
        // Crash window: ledger survived, report inbox did not.
        File.Delete(h.InboxPath(origin));
        h.Scanner = h.NewScanner();
        var count = h.Runtime.Sends.Count;
        await h.Tick();
        Assert.Equal(4, h.Inbox(origin).Messages.Count);
        Assert.All(h.Inbox(origin).Messages, m => Assert.Equal("pending", m.Status));
        Assert.Equal(count, h.Runtime.Sends.Count);
        Assert.Equal(4, h.Row(origin, "a").Reports.Count);
        Assert.Equal(5, h.State.OutboxReceipts.Count);
    }

    [Fact]
    public async Task HumanReportStopsAutomationAndSurfacesQuestion()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "a"));
        await h.Tick();
        var row = h.Row(origin, "a");
        h.Report(row.TargetId, "human", "needs_human", row.Key);
        await h.Tick();
        var calls = h.Runtime.Sends.Count;
        h.Clock += TimeSpan.FromHours(1);
        await h.Tick();
        Assert.Equal("needs_human", h.Row(origin, "a").WorkState);
        Assert.Equal(calls, h.Runtime.Sends.Count);
        Assert.Contains("Human decision?", File.ReadAllText(Path.Combine(h.Data, "bridge", "human-queue.json")));
    }

    [Theory]
    [InlineData("waiting")]
    [InlineData("blocked")]
    public async Task ExplicitWaitingOrBlockedWorkerDoesNotGetNaggedOrRecovered(string kind)
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "a"));
        await h.Tick();
        var row = h.Row(origin, "a");
        h.Report(row.TargetId, "r", kind, row.Key);
        await h.Tick();
        var count = h.Runtime.Sends.Count;
        for (var i = 0; i < 5; i++)
        {
            h.Clock += TimeSpan.FromHours(1);
            h.Scanner = h.NewScanner();
            await h.Tick();
        }
        Assert.Equal(count, h.Runtime.Sends.Count);
        Assert.Equal(0, h.Row(origin, "a").RecoveryAttempts);
    }

    [Fact]
    public async Task PersistedGrantReconstructsQueueAndInitialGrantIsNotSentTwice()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "a"));
        h.Scanner = h.NewScanner(runtime: false);
        await h.Tick();
        var row = h.Row(origin, "a");
        var originalPrompt = row.Prompt;
        File.Delete(h.InboxPath(row.TargetId));
        h.Scanner = h.NewScanner();
        await h.Tick();
        Assert.Equal(row.TargetId, h.Row(origin, "a").TargetId);
        Assert.Equal(originalPrompt, h.Inbox(row.TargetId).Messages.Single().Prompt);
        Assert.Equal($"assignment:{row.Key}", h.Inbox(row.TargetId).Messages.Single().Id);
        Assert.Single(h.Runtime.Sends);
        h.Scanner = h.NewScanner();
        await h.Tick();
        Assert.Single(h.Runtime.Sends);
    }

    [Fact]
    public async Task RecoveryExhaustionRetainsIdentityCapacityAndFilesAcrossRestart()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "src"));
        await h.Tick();
        var target = h.Row(origin, "a").TargetId;
        for (var i = 0; i < 4; i++)
        {
            h.Clock += TimeSpan.FromMinutes(11);
            h.Scanner = h.NewScanner();
            await h.Tick();
        }
        var exhausted = h.Row(origin, "a");
        Assert.Equal("recovery_required", exhausted.WorkState);
        Assert.Equal(3, exhausted.RecoveryAttempts);
        Assert.Equal(target, exhausted.TargetId);
        Assert.True(AssignmentPolicy.Holds(exhausted));
        Assert.Equal(4, h.Runtime.Sends.Count(s => s.Id == target));
        var other = h.Origin(Request("b", "new", "SRC/file"));
        await h.Tick();
        Assert.Equal("queued", h.Row(other, "b").WorkState);
        Assert.Contains("Recovery exhausted", File.ReadAllText(Path.Combine(h.Data, "bridge", "human-queue.json")));
    }

    [Fact]
    public async Task TransportExhaustionIsUncertainNotFailureAndCancellationDoesNotDispatchQueuedGrant()
    {
        using var h = new Harness();
        h.Runtime.Handler = (_, _) => throw new IOException("offline");
        var origin = h.Origin(Request("a", "new", "src"));
        for (var i = 0; i < RetryPolicy.MaxAttempts; i++)
        {
            await h.Tick();
            h.Clock += TimeSpan.FromMinutes(5);
        }
        await h.Tick();
        Assert.Equal("recovery_required", h.Row(origin, "a").WorkState);
        Assert.True(AssignmentPolicy.Holds(h.Row(origin, "a")));

        using var cancelled = new Harness();
        var creator = cancelled.Origin(Request("a", "new", "src"));
        cancelled.Scanner = cancelled.NewScanner(runtime: false);
        await cancelled.Tick();
        var row = cancelled.Row(creator, "a");
        var session = cancelled.Session(creator);
        session.Outbox.Add(new() { Id = "cancel", Kind = "cancel", AssignmentId = row.Key });
        cancelled.Write(session);
        cancelled.Scanner = cancelled.NewScanner();
        await cancelled.Tick();
        Assert.Equal("recovery_required", cancelled.Row(creator, "a").WorkState);
        Assert.Empty(cancelled.Runtime.Sends);
        await InboxStore.EnqueueAsync(cancelled.InboxPath(row.TargetId),
            new() { Id = "daily:later", Prompt = "Automated catch-up must not wake uncertain ownership" });
        await cancelled.Tick();
        Assert.Empty(cancelled.Runtime.Sends);
    }

    [Fact]
    public async Task RuntimeMissingNeverConsumesRetryOrRepairBudget()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "a"));
        h.Scanner = h.NewScanner(runtime: false);
        for (var i = 0; i < 5; i++)
        {
            await h.Tick();
            h.Clock += TimeSpan.FromHours(1);
        }
        var row = h.Row(origin, "a");
        Assert.Equal(0, row.Attempts);
        Assert.Equal(0, row.RecoveryAttempts);
        Assert.Equal(0, h.Inbox(row.TargetId).Messages.Single().Attempts);
    }

    [Fact]
    public async Task PersistedRepairReconstructsBeforeCooldownAndOnlyRecreatesSameNewTarget()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "src"));
        await h.Tick();
        var state = h.State;
        var row = state.Delegations.Single();
        row.RecoveryAttempts = 1; // Simulated persisted-before-enqueue repair crash.
        row.NextAttemptAt = h.Clock.AddMinutes(30).ToString("o");
        h.Save(state);
        h.Runtime.Existing.TryRemove(row.TargetId, out _);
        h.Clock += TimeSpan.FromMinutes(11);
        h.Scanner = h.NewScanner();
        await h.Tick();
        var repair = h.Inbox(row.TargetId).Messages.Single(m => m.Id.StartsWith("assignment-recovery:"));
        Assert.Equal($"assignment-recovery:{row.Key}:1", repair.Id);
        Assert.Equal("delivered", repair.Status);
        Assert.Equal(row.TargetId, h.Row(origin, "a").TargetId);
        Assert.All(h.Runtime.Creates, id => Assert.Equal(row.TargetId, id));
        Assert.Equal(1, h.Row(origin, "a").RecoveryAttempts);
    }

    [Fact]
    public async Task ManagedDependencyWaitsAndProgressCannotReacquireScopeFromRunningChild()
    {
        using var h = new Harness();
        var first = Request("first", "new", "src");
        var second = Request("second", "new", "src");
        second.DependsOn = ["first"];
        var origin = h.Origin(first, second);
        await h.Tick();
        Assert.Equal("queued", h.Row(origin, "second").WorkState);
        h.Report(h.Row(origin, "first").TargetId, "first-done", "done", h.Row(origin, "first").Key);
        await h.Tick();
        Assert.Equal("running", h.Row(origin, "second").WorkState);
        var parent = h.Row(origin, "second");
        var session = h.Session(parent.TargetId);
        session.Work = parent.Key;
        session.Outbox.Add(Request("child", "new", "src/file"));
        session.Outbox.Add(Report("wait", "waiting", parent.Key));
        h.Write(session);
        await h.Tick();
        Assert.Equal("running", h.Row(parent.TargetId, "child").WorkState);
        h.Report(parent.TargetId, "progress-too-early", "progress", parent.Key);
        await h.Tick();
        Assert.Equal("waiting", h.Row(origin, "second").WorkState);
        Assert.Equal("rejected", h.State.OutboxReceipts.Single(r => r.CommandId == "progress-too-early").Status);
    }

    [Fact]
    public async Task DormantSelfDoesNotStarveManagedWorkAcrossRestart()
    {
        using var h = new Harness();
        var idle = h.Origin(Request("idle", "self"));
        h.Live.Add(idle); // A process lock is not readiness to consume a grant.
        var session = h.Session(idle);
        session.State = "pending";
        h.Write(session);
        var worker = h.Origin(Request("managed", "new", "src"));
        await h.Tick();
        Assert.Equal("queued", h.Row(idle, "idle").WorkState);
        Assert.False(AssignmentPolicy.Holds(h.Row(idle, "idle")));
        Assert.Equal("running", h.Row(worker, "managed").WorkState);
        Assert.Single(h.Runtime.Creates);
        h.Scanner = h.NewScanner();
        await h.Tick();
        Assert.Equal("queued", h.Row(idle, "idle").WorkState);
        Assert.Single(h.Runtime.Creates);
        Assert.Single(h.Runtime.Sends);
    }

    [Fact]
    public async Task ExplicitReadersShareCapacityButConflictingWriterWaitsForReports()
    {
        using var h = new Harness();
        var a = Request("reader-a", "new");
        a.AccessMode = "read_only";
        a.Reads = ["src"];
        var b = Request("reader-b", "new");
        b.AccessMode = "read_only";
        b.Reads = ["src"];
        var origin = h.Origin(a, b, Request("writer", "new", "src/file"));
        await h.Tick();
        Assert.Equal(2, h.State.Delegations.Count(r => r.WorkState == "running"));
        Assert.Equal("queued", h.Row(origin, "writer").WorkState);
        h.Report(h.Row(origin, "reader-a").TargetId, "done-a", "done", h.Row(origin, "reader-a").Key);
        await h.Tick();
        Assert.Equal("queued", h.Row(origin, "writer").WorkState);
        h.Report(h.Row(origin, "reader-b").TargetId, "done-b", "done", h.Row(origin, "reader-b").Key);
        await h.Tick();
        Assert.Equal("running", h.Row(origin, "writer").WorkState);
    }

    [Theory]
    [InlineData("done")]
    [InlineData("working")]
    [InlineData("waiting_input")]
    public async Task LiveCliNeverReceivesSecondSdkHostEvenWhenTerminal(string state)
    {
        using var h = new Harness();
        var id = h.Origin();
        var session = h.Session(id);
        session.State = state;
        h.Write(session);
        h.Live.Add(id);
        await InboxStore.EnqueueAsync(h.InboxPath(id), new() { Id = "notice", Prompt = "Approved input" });
        await h.Tick();
        Assert.Empty(h.Runtime.Sends);
        Assert.Equal(0, h.Inbox(id).Messages.Single().Attempts);
        h.Live.Remove(id);
        await h.Tick();
        Assert.Single(h.Runtime.Sends);
    }

    [Fact]
    public async Task RootHumanGateBlocksQueuedChildrenAndAutomatedReportDelivery()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("a", "new", "a"));
        await h.Tick();
        var row = h.Row(origin, "a");
        var session = h.Session(origin);
        session.State = "needs_human";
        session.Needs = [new() { Resolver = "human", Text = "Decision" }];
        session.Question = "Proceed?";
        h.Write(session);
        h.Report(row.TargetId, "done", "done", row.Key);
        await h.Tick();
        Assert.Equal("done", h.Row(origin, "a").WorkState);
        Assert.Equal("pending", h.Inbox(origin).Messages.Single().Status);
        Assert.Single(h.Runtime.Sends);
    }

    [Fact]
    public async Task WaitingSupervisorYieldsOnlyAfterRuntimeTurnFinishesAndNeverAutoCompletes()
    {
        using var h = new Harness();
        var origin = h.Origin(Request("parent", "new", "src"));
        var release = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        h.Runtime.Handler = (_, _) => release.Task;
        await h.Scanner.RunOnceAsync();
        var parent = h.Row(origin, "parent");
        var worker = h.Session(parent.TargetId);
        worker.Work = parent.Key;
        worker.Outbox = [Request("child", "new", "src/file"),
            Report("wait", "waiting", parent.Key)];
        h.Write(worker);
        await h.Scanner.RunOnceAsync();
        Assert.Equal("queued", h.Row(parent.TargetId, "child").WorkState);
        release.SetResult("yielded");
        await h.Scanner.WaitForIdleAsync();
        h.Runtime.Handler = (_, _) => Task.FromResult<string?>("turn ended");
        await h.Tick();
        var child = h.Row(parent.TargetId, "child");
        Assert.Equal("running", child.WorkState);
        Assert.Equal("waiting", h.Row(origin, "parent").WorkState);
        h.Report(child.TargetId, "done", "done", child.Key);
        await h.Tick();
        Assert.Equal("waiting", h.Row(origin, "parent").WorkState);
        h.Report(parent.TargetId, "parent-done", "done", parent.Key);
        await h.Tick();
        Assert.Equal("done", h.Row(origin, "parent").WorkState);
    }

    [Fact]
    public async Task LegacyParentDoesNotFeedEarlyResultWhileSupervisorWaitsForV2Children()
    {
        using var h = new Harness();
        var origin = h.Origin();
        var supervisor = h.Origin(Request("child", "new", "src"));
        var session = h.Session(supervisor);
        session.State = "waiting_input";
        session.Question = "Children pending";
        h.Write(session);
        h.Save(new BridgeState { Delegations = [new() { Key = origin + ":legacy", OriginId = origin,
            TargetId = supervisor, Status = "assigned", CreateSession = true, Prompt = "Approved parent work", WantResult = true }] });
        await h.Tick();
        Assert.DoesNotContain(h.Inbox(origin).Messages, m => m.Id.StartsWith("result:"));
        Assert.NotEqual("result_fed", h.State.Delegations.Single(d => d.Protocol is null).Status);
        Assert.Equal("running", h.Row(supervisor, "child").WorkState);
    }

    static OutboxCommand Request(string id, string mode, params string[] writes) =>
        AssignmentPolicyTests.Request(id, mode, writes);
    static OutboxCommand Report(string id, string kind, string key) => new()
    {
        Id = id, Kind = "report", AssignmentId = key, ReportKind = kind, Summary = $"{kind} observed",
        Evidence = ["test artifact"], Verification = "tests passed", Question = kind == "needs_human" ? "Human decision?" : null,
    };

    sealed class Harness : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "para-assignment", Guid.NewGuid().ToString("N"));
        public string Data => Path.Combine(Root, "data");
        public DateTimeOffset Clock = DateTimeOffset.Parse("2026-10-20T00:00:00Z");
        public Runtime Runtime { get; } = new();
        public HashSet<string> Live { get; } = new();
        public Scanner Scanner;
        public Harness()
        {
            var agentsDir = Path.Combine(Root, ".github", "agents");
            Directory.CreateDirectory(agentsDir);
            File.WriteAllText(Path.Combine(agentsDir, "coder.agent.md"), "---\nname: coder\n---\n");
            File.WriteAllText(Path.Combine(agentsDir, "reviewer.agent.md"), "---\nname: reviewer\n---\n");
            Scanner = NewScanner();
        }
        public Scanner NewScanner(bool runtime = true) =>
            new(Data, Root, null, 24, runtime ? Runtime : null, () => Clock, _ => null, Live.Contains);
        public BridgeState State => Json.Read<BridgeState>(Path.Combine(Data, "bridge", "state.json"))!;
        public Delegation Row(string origin, string id) => State.Delegations.Single(d => d.Key == AssignmentPolicy.Key(origin, id));
        public SessionFile Session(string id) => File.Exists(Path.Combine(Data, "sessions", id + ".json"))
            ? Json.Read<SessionFile>(Path.Combine(Data, "sessions", id + ".json"))!
            : new() { SessionId = id, UpdatedAt = Clock.ToString("o") };
        public void Write(SessionFile session) => Json.WriteAtomic(Path.Combine(Data, "sessions", session.SessionId + ".json"), session);
        public string InboxPath(string id) => Path.Combine(Data, "inbox", id + ".json");
        public InboxFile Inbox(string id) => File.Exists(InboxPath(id)) ? Json.Read<InboxFile>(InboxPath(id))! : new();
        public void Save(BridgeState state) => Json.WriteAtomic(Path.Combine(Data, "bridge", "state.json"), state);
        public string Origin(params OutboxCommand[] commands)
        {
            var id = Guid.NewGuid().ToString();
            Runtime.Existing.TryAdd(id, 0);
            Write(new() { SessionId = id, State = "working", UpdatedAt = Clock.ToString("o"), Outbox = commands.ToList() });
            return id;
        }
        public void Report(string sender, string id, string kind, string key)
        {
            var session = Session(sender);
            session.Outbox.Add(AssignmentLoopTests.Report(id, kind, key));
            Write(session);
        }
        public async Task Tick() { await Scanner.RunOnceAsync(); await Scanner.WaitForIdleAsync(); }
        public void Dispose() => Directory.Delete(Root, true);
    }

    sealed class Runtime : IAgentRuntime
    {
        public ConcurrentDictionary<string, byte> Existing { get; } = new();
        public ConcurrentQueue<(string Id, string Prompt)> Sends { get; } = new();
        public ConcurrentQueue<string> Creates { get; } = new();
        public ConcurrentQueue<string?> CreatedAgents { get; } = new();
        public Func<string, string, Task<string?>> Handler = (_, _) => Task.FromResult<string?>("turn ended without a report");
        public Task<IAgentSession> CreateAsync(SessionConfig config)
        {
            Existing.TryAdd(config.SessionId!, 0);
            Creates.Enqueue(config.SessionId!);
            CreatedAgents.Enqueue(config.Agent);
            return Task.FromResult<IAgentSession>(new AgentSession(this, config.SessionId!));
        }
        public Task<IAgentSession> ResumeAsync(string id, ResumeSessionConfig config) =>
            Existing.ContainsKey(id) ? Task.FromResult<IAgentSession>(new AgentSession(this, id)) :
            Task.FromException<IAgentSession>(new IOException("Session not found"));
        sealed class AgentSession(Runtime runtime, string id) : IAgentSession
        {
            public Task<string?> SendAsync(string prompt, TimeSpan timeout)
            {
                runtime.Sends.Enqueue((id, prompt));
                return runtime.Handler(id, prompt);
            }
            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        }
    }
}
