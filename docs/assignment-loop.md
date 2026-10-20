# Durable assignment loop

## Decision

PARA uses a Bridge-owned assignment list and agent-owned command outboxes.
The Bridge sleeps between scans; an agent yields when waiting. No LLM stays
running to repeatedly ask whether another worker has finished.

The operating rule applies to named roles, plain Copilot CLI and unassigned
sessions in this working directory:

1. Estimate the requested work before substantial analysis, execution or handoff.
2. Execute a bounded 1-2 point task in the same session within approved scope.
3. Decompose larger work into independently verifiable 1-2 point assignments.
4. Publish multiple requests together, with dependencies and write scopes.
5. Report progress, blockers and completion to the supervisor that created each
   assignment. Completion requires an explicit report, not merely a finished chat.

Points measure relative complexity and uncertainty, not elapsed time. The agent
estimates and reasons about scope; deterministic Bridge code validates the declared
contract, schedules work and handles transport. Smallness does not grant approval.

## What transfers from the chess agents

The design was planned with 6.1 Sol and challenged with Opus 5.5. The useful
chinese-chess-lovers mechanisms were:

| Chess mechanism | PARA adaptation |
|---|---|
| Authoritative state plus allowed next action | Read the assignment record; execute only a running grant owned by this session. |
| Reject an out-of-turn or stale move | Reject commands from a non-owner and changed payloads under an existing command ID. |
| Exclusive seat reservation | One persisted worker identity, bounded concurrency and cooperative write-scope exclusion. |
| Wait for the other player's turn | Yield the session; durable reports and grants wake Bridge-managed sessions. |
| Re-read after an uncertain submission | Reconcile receipts, assignment state and completed side effects before retrying. |

Evidence from the source investigation: `src/arena/pairing.ts` reserves seats;
`src/arena/arena.ts` authenticates owners, computes next actions, checks the
current ply and implements bounded waits; `src/app.ts` provides the external
agent loop; `src/cloud/postgres.ts` serializes state read/modify/write.
Those paths belong to **chinese-chess-lovers**, not this repository.

Chess-only turn rules, forfeits, public-room approval and compulsory play until
game end do not transfer. PARA has no generic chess task queue to copy; the
assignment/report layer is implemented here.

## Ownership and durable state

| File | Sole writer | Purpose |
|---|---|---|
| `data/sessions/<id>.json` | That session | Estimate, active work, append-only outbox, progress and overall session state. |
| `data/bridge/state.json` | Bridge scan loop | Canonical `delegations` list, including protocol-2 assignments, command receipts and existing scheduling state. |
| `data/inbox/<id>.json` | Bridge | Idempotent delivery of grants, reports, human replies and bounded recovery. |

`assignments` in the snapshot API is a projection of `delegations`, **not** a
second writable list. Legacy handoffs remain readable and retain legacy behavior;
new multi-task work uses protocol-2 rows. Transport state and work state are
separate: delivering a prompt does not complete its assignment.

Never write another session's record or the Bridge's files, even for coaching.
The shared skill and startup/stop hook apply the working agreement to default
CLI sessions as well as named agents. Discovery alone does not recruit a session.

## Command contract

Every new command has a stable ID. Preserve its payload and keep it in `outbox`.
The first version caps a session outbox at 50 entries; it does not silently
compact unacknowledged work. Inspect `outboxReceipts` for acceptance/rejection.
A rejected request must be corrected using a **new** command ID.

The session's estimate describes its overall task:

```json
{
  "estimate": {
    "points": 5,
    "rationale": "Separate persistence, scheduling and reporting behaviors"
  },
  "outbox": [
    {
      "id": "persist",
      "kind": "request",
      "mode": "new",
      "agent": "coder",
      "title": "Persist import identity",
      "points": 2,
      "prompt": "Implement only the approved import identity change. Preserve the existing dirty worktree. Source and accepted scope: <self-contained details>.",
      "acceptance": ["Restart preserves the same imported source ID"],
      "dependsOn": [],
      "writes": ["src/ImportIdentity.cs"],
      "approvalRef": "Human approved this exact scope in the creating session"
    },
    {
      "id": "verify",
      "kind": "request",
      "mode": "new",
      "agent": "reviewer",
      "title": "Verify import identity",
      "points": 1,
      "prompt": "Verify the approved identity change and report evidence; do not publish.",
      "acceptance": ["Check restart and duplicate-source behavior"],
      "dependsOn": ["persist"],
      "writes": [],
      "approvalRef": "Same bounded approval as persist"
    }
  ]
}
```

Request IDs are scoped to their submitting session. The assignment ID is
`<supervisor-session-id>:out:<request-id>`. `dependsOn` names request IDs from
that same session, including siblings submitted together. Unknown dependencies
and cycles are rejected rather than partially scheduled.

Approved independent CLI work executes directly without a Bridge grant. The Bridge
is opt-in for managed autonomous work using `mode: new`. Do not submit self requests:
there is no attended-CLI executor handshake. Queued legacy self requests remain
visible with `executor_required` and reserve no capacity. Their creator cancels
them and confirms cancellation before direct execution or a new managed request.
Already granted self work retains ownership until its owner explicitly reports.
No automatic duplicate SDK process, silent retargeting or unsafe timeout release.

`writes` contains repository-relative paths, not globs. Windows path comparisons
are case-insensitive, and directory scopes include descendants. Empty scopes
conservatively reserve the repository exclusively, including for verification
when its access is not otherwise described. These are scheduler rules, not OS
filesystem permissions.

New requests may explicitly declare `accessMode: "read_only"` and `reads` with
relative paths; Writes must then be empty. Empty/missing Reads means whole-repository
read access. Readers share capacity; readers conflict with overlapping writers.
Optional write-mode Reads also reserve declared input paths against writers.
Children cannot escalate access or broaden parent scope. Omitted accessMode keeps
the old exclusive empty-Writes behavior. Nullable new request fields are omitted
from serialization so old request hashes/receipts remain valid.

The recovery lesson from live operation is that a phase, grant, process lock,
transport delivery or accepted request is not observed execution. The Sessions
page shows recorded phases and reported state; Tasks shows canonical reservations
and blockers. Unknown states remain visible under attention. Repairing the scheduler
must not require queuing the repair behind itself: explicitly authorized independent
maintenance runs directly, cancelling its own ungranted duplicate requests first.
Do not bypass protected-path permission denials. Tooling failures use bounded safe
alternatives; only real access/approval/decision needs are human blockers.

Workers set `work` to the assignment ID supplied in their grant and append reports:

```json
{
  "work": "<supervisor-session-id>:out:persist",
  "outbox": [
    {
      "id": "persist-complete",
      "kind": "report",
      "assignmentId": "<supervisor-session-id>:out:persist",
      "reportKind": "done",
      "summary": "Preserved source identity across restart without duplicates.",
      "evidence": ["src/ImportIdentity.cs", "tests/ImportIdentityTests.cs"],
      "verification": "Focused restart and duplicate-source cases passed."
    }
  ]
}
```

Only the assigned worker can report for a row. `progress`, `waiting`, `blocked`
and `needs_human` reports are not success. Explicit `done` or `failed` reports
finish work; terminal reports include evidence and verification/limitations.
Session `state` and `result` describe the whole conversation and do not close a
protocol-2 assignment. One session may send several reports in the same outbox.

Only the creating supervisor can submit `kind: cancel` with `assignmentId` and
`summary`. A queued, unattempted assignment can be cancelled. Once execution is
uncertain, cancellation is **not** proof that tools stopped: retain ownership and
surface human attention rather than assigning a second writer.

## Bridge loop

1. Read session outboxes, including final reports from `done` sessions.
2. Validate and deduplicate commands; persist rows, reports and receipts before
   any runtime side effect.
3. Check dependency success, human gates, capacity and write conflicts.
4. Persist the selected worker identity and assignment state; enqueue a stable
   grant through the existing inbox layer.
5. Reconstruct missing grant/report deliveries on later scans using stable IDs.
6. Route each stored report to its creating supervisor, without repeated
   "still waiting" prompts on unchanged scans.
7. Recover only the same worker with bounded budgets. Uncertain/exhausted work
   needs human reconciliation and is never silently reassigned.

The supervisor waits with `state: waiting_input`, an explicit question and
outstanding requests. It integrates each report, revises future work when
necessary, and closes its parent assignment only after acceptance criteria are met.
Legacy result forwarding must not finish a supervisor while protocol-2 children
remain open.

An attended CLI session cannot safely be opened by a second SDK host. The Bridge
holds its automated deliveries while it is live; the current CLI user/follow-up
or a later safe resume consumes pending work. This is different from a
Bridge-managed worker yielding between turns. Do not promise instantaneous
automatic wake-up for every open terminal.

## Responsibility boundary

**Code:** command identity, structural validation, graph checks, ownership,
capacity, normalized write conflicts, persistence ordering, notification
deduplication, bounded recovery and failure visibility.

**Agents:** estimates, decomposition quality, interpretation of human approval,
acceptance judgment, evidence, scope decisions, reconciliation of real side effects
and useful supervisor reports.

No automatic PR, push, merge or external work-item closure. `approvalRef` records
provenance but is not a cryptographic human capability. The Copilot SDK still
approves tool-permission requests; a claim record cannot fence an arbitrary
filesystem tool. Delivery is at least once, so stable IDs cannot guarantee
exactly-once real-world effects.

This increment deliberately avoids automatic worker recruitment, arbitrary
existing-session assignment, transferable leases, a second job store, and
LLM-based scheduling of deterministic state transitions.

## Implementation breakdown

These are bounded implementation units, not one large task disguised as a worker:

| Unit | Points | Output |
|---|---:|---|
| Contracts | 2 | Additive estimates, commands, receipts and assignment reports. |
| Policy | 2 | Dependency, capacity and write-conflict rules. |
| Ingestion | 2 | Durable multi-request acceptance and immutable-ID deduplication. |
| Execution/report loop | 2 | Grants, explicit terminal reports, waiting and conservative recovery. |
| Agent working agreement | 2 | Universal estimation, decomposition and report/wait instructions with hook checks. |
| Snapshot and observation | 2 | Read-only canonical assignment/report/receipt projection and dashboard list. |

Keep one owner per shared file and integrate supervisor reports, not another
agent's hidden conversation. Protocol and backend steps must agree on the same
field names. The regression suite uses fake runtimes and temporary data; never
run a test scanner or `--once` against a live team directory.
