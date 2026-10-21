using System.Collections.Concurrent;
using Bridge;
using GitHub.Copilot;
using Xunit;

namespace BridgeTests;

public class ScannerTests
{
    [Fact]
    public async Task SavedHandoffSurvivesOriginChangingAndRestartWithoutDuplicateResult()
    {
        using var h = new Harness();
        var origin = h.Origin();
        h.Runtime.Handler = (_, _) => throw new IOException("transient runtime failure");
        await h.Tick();
        var target = h.State.Delegations.Single().TargetId;
        var changed = h.Session(origin);
        changed.Handoff = null;
        h.Write(changed);
        h.Scanner = h.NewScanner();
        h.Clock += TimeSpan.FromSeconds(14);
        await h.Tick();
        Assert.Single(h.Runtime.Sends);
        h.Clock += TimeSpan.FromSeconds(1);
        h.Runtime.Handler = (id, _) => h.Complete(id);
        await h.Tick();
        await h.Tick();
        await h.Tick();
        Assert.Equal("result_fed", h.State.Delegations.Single().Status);
        Assert.Equal(2, h.Runtime.Sends.Count(s => s.Id == target));
        Assert.Single(h.Inbox(origin).Messages, m => m.Id.StartsWith("result:"));
        var count = h.Runtime.Sends.Count;
        await h.Tick();
        Assert.Equal(count, h.Runtime.Sends.Count);
    }

    [Fact]
    public async Task MissingLegacyTargetWithoutOriginalPromptFailsVisiblyInsteadOfReplayingUnrelatedWork()
    {
        using var h = new Harness();
        var origin = h.Origin();
        var s = h.Session(origin);
        s.Handoff = null;
        h.Write(s);
        var missing = Guid.NewGuid().ToString();
        h.SaveState(new BridgeState
        {
            Delegations = new() { new() { Key = origin + ":old-task", OriginId = origin, TargetId = missing, Status = "assigned", WantResult = true } },
        });
        await h.Tick();
        Assert.Equal("failed", h.State.Delegations.Single().Status);
        Assert.Empty(h.Runtime.Creates);
        await h.Tick();
        Assert.Contains(h.Inbox(origin).Messages, m => m.Prompt.Contains("BREAKPOINT"));
    }

    [Fact]
    public async Task MissingSavedTargetIsRecreatedUnderTheSameDurableIdentity()
    {
        using var h = new Harness();
        var origin = h.Origin();
        var target = Guid.NewGuid().ToString();
        h.SaveState(new BridgeState
        {
            Delegations = new() { new()
            {
                Key = origin + ":task-1", OriginId = origin, TargetId = target, Status = "assigned",
                CreateSession = true, Prompt = "Approved bounded local work", WantResult = true,
            } },
        });
        await h.Tick();
        Assert.Contains(target, h.Runtime.Creates);
        Assert.Equal(target, h.State.Delegations.Single().TargetId);
        await h.Tick();
        await h.Tick();
        Assert.Equal("result_fed", h.State.Delegations.Single().Status);
    }

#pragma warning disable GHCP001
    [Fact]
    public async Task BridgeSessionsApprovePermissionsAndEnableBoundedAutopilotContinuation()
    {
        using var h = new Harness();
        var resumedId = Guid.NewGuid().ToString();
        var createdId = Guid.NewGuid().ToString();
        h.Runtime.Existing[resumedId] = 0;
        await InboxStore.EnqueueAsync(Path.Combine(h.Data, "inbox", resumedId + ".json"),
            new InboxMessage { Id = "resume", Prompt = "Continue approved work" });
        await InboxStore.EnqueueAsync(Path.Combine(h.Data, "inbox", createdId + ".json"),
            new InboxMessage { Id = "create", Prompt = "Start approved work", CreateSession = true });

        await h.Tick();

        Assert.NotEmpty(h.Runtime.ResumeConfigs);
        Assert.All(h.Runtime.ResumeConfigs, resumeConfig =>
        {
            Assert.NotNull(resumeConfig.OnPermissionRequest);
            Assert.Equal(true, resumeConfig.Autopilot?.ContinuationEnabled);
            Assert.Equal(5, resumeConfig.Autopilot?.MaxContinues);
        });

        var createConfig = Assert.Single(h.Runtime.CreateConfigs);
        Assert.NotNull(createConfig.OnPermissionRequest);
        Assert.Equal(true, createConfig.Autopilot?.ContinuationEnabled);
        Assert.Equal(5, createConfig.Autopilot?.MaxContinues);
    }
#pragma warning restore GHCP001

    [Fact]
    public async Task FiveTransportFailuresStopRetryingAndSurfaceTheError()
    {
        using var h = new Harness();
        h.Origin();
        h.Runtime.Handler = (_, _) => throw new IOException("service offline");
        for (var n = 0; n < RetryPolicy.MaxAttempts; n++)
        {
            await h.Tick();
            h.Clock += TimeSpan.FromMinutes(5);
        }
        await h.Tick();
        var d = h.State.Delegations.Single();
        Assert.Equal("failed", d.Status);
        Assert.Equal(RetryPolicy.MaxAttempts, d.Attempts);
        Assert.Contains("service offline", d.LastError);
        var targetCalls = h.Runtime.Sends.Count(s => s.Id == d.TargetId);
        await h.Tick();
        Assert.Equal(targetCalls, h.Runtime.Sends.Count(s => s.Id == d.TargetId));
        Assert.Contains("service offline", File.ReadAllText(Path.Combine(h.Data, "bridge", "human-queue.json")));
    }

    [Fact]
    public async Task OneBlockedTurnDoesNotBlockOtherSessionsOrAllowOverlappingTurns()
    {
        using var h = new Harness();
        var slow = h.Origin();
        var fast = h.Origin();
        var release = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        h.Runtime.Handler = (id, prompt) =>
        {
            if (prompt.Contains(slow))
            {
                started.TrySetResult();
                return release.Task;
            }
            return h.Complete(id);
        };
        await h.Scanner.RunOnceAsync();
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        var target = h.State.Delegations.Single(d => d.OriginId == slow).TargetId;
        await InboxStore.EnqueueAsync(Path.Combine(h.Data, "inbox", target + ".json"), new InboxMessage { Prompt = "another message" });
        await h.Scanner.RunOnceAsync();
        Assert.Single(h.Runtime.Sends, s => s.Id == target);
        Assert.Contains(h.Runtime.Sends, s => s.Prompt.Contains(fast));
        release.SetResult("turn finished");
        await h.Scanner.WaitForIdleAsync();
    }

    [Fact]
    public async Task CrashDuringDeliveryReclaimsTheSameMessageAfterItsLease()
    {
        using var h = new Harness();
        var id = h.Origin();
        var s = h.Session(id);
        s.Handoff = null;
        h.Write(s);
        await InboxStore.EnqueueAsync(Path.Combine(h.Data, "inbox", id + ".json"), new InboxMessage
        {
            Id = "persistent-message", Prompt = "continue approved work", Status = "delivering",
            Attempts = 1, NextAttemptAt = h.Clock.AddMinutes(1).ToString("o"),
        });
        await h.Tick();
        Assert.Empty(h.Runtime.Sends);
        h.Clock += TimeSpan.FromMinutes(1);
        await h.Tick();
        var message = Assert.Single(h.Inbox(id).Messages);
        Assert.Equal("delivered", message.Status);
        Assert.Equal(2, message.Attempts);
        Assert.Contains("persistent-message", h.Runtime.Sends.Single().Prompt);
    }

    [Fact]
    public async Task UnreadableBridgeStateIsPreservedWithoutRuntimeSideEffects()
    {
        using var h = new Harness();
        var path = Path.Combine(h.Data, "bridge", "state.json");
        File.WriteAllText(path, "{ incomplete");
        await Assert.ThrowsAsync<IOException>(() => h.Scanner.RunOnceAsync());
        Assert.Equal("{ incomplete", File.ReadAllText(path));
        Assert.Empty(h.Runtime.Sends);
    }

    [Fact]
    public void OnlyOneBridgeCanOwnADataDirectory()
    {
        using var h = new Harness();
        using var first = new BridgeLease(h.Data);
        Assert.Throws<IOException>(() => new BridgeLease(h.Data));
    }

    [Fact]
    public async Task NoRuntimeDoesNotConsumeInboxRetryBudget()
    {
        using var h = new Harness();
        h.Origin();
        h.Scanner = new Scanner(h.Data, h.Root, null, 24, null, () => h.Clock, _ => null);
        await h.Tick();
        var d = h.State.Delegations.Single();
        Assert.Equal(0, h.Inbox(d.TargetId).Messages.Single().Attempts);
        Assert.Equal(0, d.RecoveryAttempts);
    }

    [Fact]
    public async Task NoRuntimeDoesNotConsumeProtocolRepairRecoveryBudget()
    {
        using var h = new Harness();
        var origin = h.Origin();
        var target = Guid.NewGuid().ToString();
        h.Write(new SessionFile { SessionId = target, State = "done" });
        h.SaveState(new BridgeState
        {
            Delegations = new() { new()
            {
                Key = origin + ":task-1", OriginId = origin, TargetId = target, Status = "assigned",
                CreateSession = true, Prompt = "approved task", WantResult = true,
            } },
        });
        h.Scanner = new Scanner(h.Data, h.Root, null, 24, null, () => h.Clock, _ => null);
        await h.Tick();
        Assert.Equal(0, h.State.Delegations.Single().RecoveryAttempts);
    }

    [Fact]
    public async Task RecentlyActiveSessionDefersInboxDeliveryUntilItIsQuiet()
    {
        using var h = new Harness();
        var id = h.Origin();
        var s = h.Session(id);
        s.Handoff = null;
        s.State = "working";
        h.Write(s);
        var lastEvent = h.Clock;
        h.Scanner = new Scanner(h.Data, h.Root, null, 24, h.Runtime, () => h.Clock, _ => lastEvent);
        await InboxStore.EnqueueAsync(Path.Combine(h.Data, "inbox", id + ".json"), new InboxMessage { Prompt = "approved work" });
        await h.Tick();
        Assert.Empty(h.Runtime.Sends);
        Assert.Equal(0, h.Inbox(id).Messages.Single().Attempts);
        h.Clock += Inspector.SilentAfter + TimeSpan.FromSeconds(1);
        await h.Tick();
        Assert.Single(h.Runtime.Sends);
    }

    [Fact]
    public async Task DailyFailureRetriesAfterBackoffWithoutBlockingNormalWork()
    {
        using var h = new Harness(dailyHour: 0);
        h.Runtime.Handler = (id, prompt) => prompt.Contains("Daily scrum")
            ? throw new IOException("temporary scrum failure") : h.Complete(id);
        await h.Tick();
        Assert.Null(h.State.LastDailyRun);
        Assert.Single(h.Runtime.Sends);
        await h.Tick();
        Assert.Single(h.Runtime.Sends);
        h.Clock += TimeSpan.FromSeconds(15);
        h.Runtime.Handler = (id, _) => h.Complete(id);
        await h.Tick();
        await h.Tick();
        Assert.Equal(h.Clock.ToLocalTime().ToString("yyyy-MM-dd"), h.State.LastDailyRun);
    }

    [Fact]
    public async Task HumanApprovalIsNeverResumedByDailyOrRecoveryMessages()
    {
        using var h = new Harness();
        var id = h.Origin();
        h.Write(new SessionFile
        {
            SessionId = id, Phase = "approval", State = "needs_human", Question = "Should PARA implement this?",
            Needs = new() { new() { Text = "Implementation approval", Resolver = "human" } },
        });
        await InboxStore.EnqueueAsync(Path.Combine(h.Data, "inbox", id + ".json"),
            new InboxMessage { Id = "daily:yesterday", Prompt = "catch up" });
        await h.Tick();
        Assert.Empty(h.Runtime.Sends);
        Assert.Equal("needs_human", h.Session(id).State);
        await InboxStore.EnqueueHumanReplyAsync(Path.Combine(h.Data, "inbox", id + ".json"),
            new InboxMessage { From = "user", Prompt = "Approved bounded implementation" });
        await h.Tick();
        Assert.Contains("Approved bounded implementation", Assert.Single(h.Runtime.Sends).Prompt);
        Assert.Equal("pending", h.Inbox(id).Messages[0].Status);
    }

    [Fact]
    public async Task AcknowledgedResultIsNotReplayedWhenTargetIsNowWorkingOnAnotherTask()
    {
        using var h = new Harness();
        var origin = h.Origin();
        await h.Tick();
        await h.Tick();
        var target = h.State.Delegations.Single().TargetId;
        h.Write(new SessionFile { SessionId = target, State = "working", UpdatedAt = h.Clock.ToString("o") });
        h.Scanner = h.NewScanner();
        var sent = h.Runtime.Sends.Count;
        await h.Tick();
        Assert.Equal("result_fed", h.State.Delegations.Single().Status);
        Assert.Equal(sent, h.Runtime.Sends.Count);
    }

    [Fact]
    public async Task RecoveryBudgetSurvivesRestartsAndEventuallyEscalates()
    {
        using var h = new Harness();
        h.Origin();
        h.Runtime.Handler = (_, _) => Task.FromResult<string?>("No protocol update");
        await h.Tick();
        for (var n = 0; n < 4; n++)
        {
            h.Scanner = h.NewScanner();
            await h.Tick();
            h.Clock += TimeSpan.FromMinutes(11);
        }
        var d = h.State.Delegations.Single();
        Assert.Equal("failed", d.Status);
        Assert.Equal(3, d.RecoveryAttempts);
        Assert.Equal(4, h.Runtime.Sends.Count(s => s.Id == d.TargetId));
    }

    [Fact]
    public async Task ExistingTargetsAreNeverRecreatedAndTransportErrorsNeverTriggerCreation()
    {
        using var h = new Harness();
        var origin = h.Origin();
        var s = h.Session(origin);
        s.Handoff!.Target = Guid.NewGuid().ToString();
        h.Write(s);
        await h.Tick();
        Assert.Empty(h.Runtime.Creates);
        Assert.Equal("pending", h.Inbox(s.Handoff.Target).Messages.Single().Status);

        using var other = new Harness();
        other.Origin();
        other.Runtime.ResumeError = new IOException("Transport disconnected");
        await other.Tick();
        Assert.Empty(other.Runtime.Creates);
        var d = other.State.Delegations.Single();
        Assert.Equal("Transport disconnected", other.Inbox(d.TargetId).Messages.Single().LastError);
    }

    [Fact]
    public async Task ATaskCannotDelegateBackToItsAncestor()
    {
        using var h = new Harness();
        var ancestor = Guid.NewGuid().ToString();
        var child = h.Origin();
        var s = h.Session(child);
        s.Handoff!.Target = ancestor.ToUpperInvariant();
        h.Write(s);
        h.SaveState(new BridgeState
        {
            Delegations = new() { new() { Key = ancestor + ":parent", OriginId = ancestor, TargetId = child, Status = "result_fed" } },
        });
        await h.Tick();
        Assert.Equal("limit_reached", h.State.Delegations.Single(d => d.OriginId == child).Status);
        Assert.Empty(h.Runtime.Creates);
    }

    [Fact]
    public async Task ConcurrentHumanRepliesAreRejectedUntilTheFirstOneFinishes()
    {
        using var h = new Harness();
        var id = h.Origin();
        var path = Path.Combine(h.Data, "inbox", id + ".json");
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async n =>
        {
            try { await InboxStore.EnqueueHumanReplyAsync(path, new InboxMessage { From = "user", Prompt = $"answer {n}" }); return true; }
            catch (InvalidOperationException) { return false; }
        }));
        Assert.Single(results, ok => ok);
        var first = Assert.Single(h.Inbox(id).Messages);
        first.Status = "delivered";
        await InboxStore.UpdateMessageAsync(path, first);
        await InboxStore.EnqueueHumanReplyAsync(path, new InboxMessage { From = "user", Prompt = "next decision" });
        Assert.Equal(2, h.Inbox(id).Messages.Count);
    }

    sealed class Harness : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "para-scanner", Guid.NewGuid().ToString("N"));
        public string Data => Path.Combine(Root, "data");
        public DateTimeOffset Clock = DateTimeOffset.UtcNow;
        public FakeRuntime Runtime { get; }
        public Scanner Scanner { get; set; }
        readonly int _dailyHour;
        public Harness(int dailyHour = 24)
        {
            _dailyHour = dailyHour;
            Runtime = new();
            Scanner = NewScanner();
            Runtime.Handler = (id, _) => Complete(id);
        }
        public Scanner NewScanner() => new(Data, Root, null, _dailyHour, Runtime, () => Clock, _ => null);
        public BridgeState State => Json.Read<BridgeState>(Path.Combine(Data, "bridge", "state.json"))!;
        public InboxFile Inbox(string id) => Json.Read<InboxFile>(Path.Combine(Data, "inbox", id + ".json"))!;
        public SessionFile Session(string id) => Json.Read<SessionFile>(Path.Combine(Data, "sessions", id + ".json"))!;
        public void Write(SessionFile s) => Json.WriteAtomic(Path.Combine(Data, "sessions", s.SessionId + ".json"), s);
        public void SaveState(BridgeState state) => Json.WriteAtomic(Path.Combine(Data, "bridge", "state.json"), state);
        public string Origin()
        {
            var id = Guid.NewGuid().ToString();
            Runtime.Existing[id] = 0;
            Write(new SessionFile
            {
                SessionId = id, State = "waiting_input", Agent = "coordinator", Question = "Waiting for approved work",
                Handoff = new() { Id = "task-1", Prompt = "Approved bounded local work", Agent = "coder" },
            });
            return id;
        }
        public Task<string?> Complete(string id)
        {
            Write(new SessionFile { SessionId = id, State = "done", Result = "Verified local work", UpdatedAt = Clock.ToString("o") });
            return Task.FromResult<string?>("done");
        }
        public async Task Tick()
        {
            await Scanner.RunOnceAsync();
            await Scanner.WaitForIdleAsync();
        }
        public void Dispose() => Directory.Delete(Root, recursive: true);
    }

    sealed class FakeRuntime : IAgentRuntime
    {
        public Exception? ResumeError { get; set; }
        public ConcurrentDictionary<string, byte> Existing { get; } = new();
        public ConcurrentQueue<string> Creates { get; } = new();
        public ConcurrentQueue<SessionConfig> CreateConfigs { get; } = new();
        public ConcurrentQueue<ResumeSessionConfig> ResumeConfigs { get; } = new();
        public ConcurrentQueue<(string Id, string Prompt)> Sends { get; } = new();
        public Func<string, string, Task<string?>> Handler { get; set; } = (_, _) => Task.FromResult<string?>("done");
        public Task<IAgentSession> CreateAsync(SessionConfig config)
        {
            var id = config.SessionId!;
            Existing[id] = 0;
            Creates.Enqueue(id);
            CreateConfigs.Enqueue(config);
            return Task.FromResult<IAgentSession>(new FakeSession(this, id));
        }
        public Task<IAgentSession> ResumeAsync(string id, ResumeSessionConfig config)
        {
            ResumeConfigs.Enqueue(config);
            return ResumeError is not null ? Task.FromException<IAgentSession>(ResumeError) : Existing.ContainsKey(id)
                ? Task.FromResult<IAgentSession>(new FakeSession(this, id))
                : Task.FromException<IAgentSession>(new IOException("Session not found: " + id));
        }
        sealed class FakeSession(FakeRuntime runtime, string id) : IAgentSession
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
