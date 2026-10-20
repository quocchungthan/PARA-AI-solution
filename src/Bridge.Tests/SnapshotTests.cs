using System.Reflection;
using System.Text.Json;
using Bridge;
using Xunit;

namespace BridgeTests;

public class SnapshotTests
{
    static JsonElement ReadSnapshot(string dataDir)
    {
        var method = typeof(Api).GetMethod("Snapshot", BindingFlags.Static | BindingFlags.NonPublic)!;
        return JsonSerializer.SerializeToElement(method.Invoke(null, [dataDir, dataDir]), Json.Options);
    }

    [Fact]
    public void AssignmentSnapshotProjectsOneLedgerWithoutExposingExecutablePrompts()
    {
        var root = Path.Combine(Path.GetTempPath(), "para-snapshot", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "bridge"));
        try
        {
            Json.WriteAtomic(Path.Combine(root, "bridge", "state.json"), new
            {
                delegations = new[] { new
                {
                    key = "supervisor:out:task", protocol = 2, originId = "supervisor", targetId = "worker",
                    title = "Bounded task", workState = "waiting", status = "assigned", points = 2,
                    prompt = "Executable prompt excluded from this public metadata projection",
                    reports = new[] { new { id = "r1", kind = "waiting", summary = "Waiting for dependency evidence", evidence = Array.Empty<string>() } },
                } },
                outboxReceipts = new[] { new { sessionId = "supervisor", commandId = "task", status = "accepted", assignmentId = "supervisor:out:task", payloadHash = "internal-hash" } },
            });
            var snapshot = ReadSnapshot(root);
            var assignment = Assert.Single(snapshot.GetProperty("assignments").EnumerateArray());
            Assert.Equal("waiting", assignment.GetProperty("workState").GetString());
            Assert.Equal("waiting", Assert.Single(assignment.GetProperty("reports").EnumerateArray()).GetProperty("kind").GetString());
            Assert.False(assignment.TryGetProperty("prompt", out _));
            Assert.Equal(assignment.GetProperty("key").GetString(),
                Assert.Single(snapshot.GetProperty("delegations").EnumerateArray()).GetProperty("key").GetString());
            var receipt = Assert.Single(snapshot.GetProperty("outboxReceipts").EnumerateArray());
            Assert.False(receipt.TryGetProperty("payloadHash", out _));
        }
        finally { Directory.Delete(root, recursive: true); }
    }

    [Fact]
    public void UnreadableLedgerIsVisibleAndNotReplacedByAnEmptySuccess()
    {
        var root = Path.Combine(Path.GetTempPath(), "para-snapshot", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "bridge"));
        var path = Path.Combine(root, "bridge", "state.json");
        try
        {
            File.WriteAllText(path, "{ interrupted");
            var snapshot = ReadSnapshot(root);
            Assert.Contains("could not be read", snapshot.GetProperty("assignmentError").GetString());
            Assert.Equal("{ interrupted", File.ReadAllText(path));
        }
        finally { Directory.Delete(root, recursive: true); }
    }
}
