using Bridge;
using Xunit;

namespace Bridge.Tests;

public class AssignmentOperationalTests
{
    [Fact]
    public void ScanSummaryCountsCanonicalV2WorkStatesNotLegacyTransportStatus()
    {
        var state = new BridgeState
        {
            Delegations =
            [
                new() { Protocol = 2, WorkState = "queued", Status = "assigned" },
                new() { Protocol = 2, WorkState = "queued" },
                new() { Protocol = 2, WorkState = "running" },
                new() { Protocol = 2, WorkState = "blocked" },
                new() { Protocol = 2, WorkState = "recovery_required" },
                new() { WorkState = "running", Status = "assigned" },
            ],
        };
        Assert.Equal("v2_queued=2 v2_running=1 v2_waiting=0 v2_blocked=1 v2_needs_human=0 " +
            "v2_recovery_required=1 v2_done=0 v2_failed=0 v2_cancelled=0", Scanner.AssignmentScanSummary(state));
        Assert.Contains("v2_queued=0", Scanner.AssignmentScanSummary(new()));
    }
}
