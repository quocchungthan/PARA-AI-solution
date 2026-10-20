using System.Text.Json;
using Bridge;
using Xunit;

namespace Bridge.Tests;

public class AssignmentContractTests
{
    [Fact]
    public void FrozenContractRoundTripsAndLegacyDoesNotRequireEstimate()
    {
        var session = new SessionFile
        {
            SessionId = "origin", Work = "origin:out:1",
            Estimate = new() { Points = 2, Rationale = "bounded" },
            Outbox = [new() { Id = "1", Kind = "request", Points = 2, Mode = "self",
                Prompt = "implement", Acceptance = ["passes"], ApprovalRef = "user request" }],
        };
        var json = JsonSerializer.Serialize(session, Json.Options);
        Assert.Contains("\"estimate\"", json);
        Assert.Contains("\"outbox\"", json);
        Assert.Equal(2, JsonSerializer.Deserialize<SessionFile>(json, Json.Options)!.Estimate!.Points);
        Assert.Empty(SessionHealth.Issues(new SessionFile { UpdatedAt = DateTimeOffset.UtcNow.ToString("o") }));
        session.State = "waiting_input";
        Assert.Empty(SessionHealth.Issues(session));
        var state = new BridgeState
        {
            Delegations = [new() { Protocol = 2, Key = "origin:out:1", WorkState = "running",
                Reports = [new() { Id = "r", Kind = "done", Summary = "tested", Evidence = ["test"], Verification = "passed" }] }],
            OutboxReceipts = [new() { SessionId = "origin", CommandId = "1", PayloadHash = "hash", Status = "accepted" }],
        };
        var restored = JsonSerializer.Deserialize<BridgeState>(JsonSerializer.Serialize(state, Json.Options), Json.Options)!;
        Assert.Equal("done", restored.Delegations[0].Reports[0].Kind);
        Assert.Single(restored.OutboxReceipts);
    }

    [Fact]
    public void OptionalScopesDoNotChangeLegacyPayloadOrReceiptHash()
    {
        var command = AssignmentPolicyTests.Request();
        var legacyJson = System.Text.Json.Nodes.JsonNode.Parse(JsonSerializer.Serialize(command, Json.Options))!.AsObject();
        legacyJson.Remove("accessMode");
        legacyJson.Remove("reads");
        var expected = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(legacyJson.ToJsonString(Json.Options))));
        Assert.Equal(expected, AssignmentPolicy.Hash(command));
        var state = new BridgeState { OutboxReceipts = [new()
            { SessionId = "origin", CommandId = command.Id, PayloadHash = expected, Status = "accepted" }] };
        AssignmentIngestor.Apply(state, new() { SessionId = "origin", Outbox = [command] },
            DateTimeOffset.UtcNow, AssignmentPolicyTests.AgentRoles);
        Assert.Null(state.OutboxReceipts.Single().CollisionHash);
        command.AccessMode = "read_only";
        command.Reads = ["docs"];
        Assert.NotEqual(expected, AssignmentPolicy.Hash(command));
    }
}
