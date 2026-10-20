using Bridge;
using Xunit;

namespace BridgeTests;

public class ReliabilityTests
{
    [Fact]
    public void RetryPolicyUsesExponentialBackoffAndCapsTheDelay()
    {
        var now = DateTimeOffset.UtcNow;

        Assert.Equal(now.AddSeconds(15), RetryPolicy.NextAttempt(1, now));
        Assert.Equal(now.AddSeconds(30), RetryPolicy.NextAttempt(2, now));
        Assert.Equal(now.AddMinutes(15), RetryPolicy.NextAttempt(20, now));
    }

    [Fact]
    public void RetryPolicyTreatsMissingScheduleAsDue()
    {
        var now = DateTimeOffset.UtcNow;

        Assert.True(RetryPolicy.IsDue(null, now));
        Assert.True(RetryPolicy.IsDue(now.AddSeconds(-1).ToString("o"), now));
        Assert.False(RetryPolicy.IsDue(now.AddSeconds(1).ToString("o"), now));
    }

    [Fact]
    public async Task InboxEnqueueIsIdempotentAndRetryMetadataSurvivesWrites()
    {
        var dir = Path.Combine(Path.GetTempPath(), "para-bridge-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "session.json");
        try
        {
            var first = new InboxMessage { Id = "stable-id", Prompt = "do work" };
            await InboxStore.EnqueueIfAbsentAsync(path, first);
            await InboxStore.EnqueueIfAbsentAsync(path, new InboxMessage { Id = "stable-id", Prompt = "duplicate" });
            first.Attempts = 2;
            first.LastError = "temporary failure";
            first.NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(1).ToString("o");
            await InboxStore.UpdateMessageAsync(path, first);

            var saved = Json.Read<InboxFile>(path)!;
            var message = Assert.Single(saved.Messages);
            Assert.Equal("do work", message.Prompt);
            Assert.Equal(2, message.Attempts);
            Assert.Equal("temporary failure", message.LastError);
            Assert.Equal(first.NextAttemptAt, message.NextAttemptAt);
        }
        finally
        {
            Directory.Delete(dir, recursive: true);
        }
    }
}
