---
name: para-session-protocol
description: Durable estimation, approval, assignment requests and reports for every PARA session. Use at task intake and state changes; only the Bridge owns scheduling and inbox delivery.
---

# PARA session protocol

Applies to **every** named/custom/default Copilot CLI session in this workdir, including unknown or unassigned sessions. These are cooperative permissions and workflow instructions, not a security sandbox. Hooks check structure and remind; they cannot prove approval, task quality or runtime ownership.

## Your key and write boundary

Your session id is the GUID at the end of your "Session folder" path (`...\session-state\<GUID>`), or the id the Bridge supplied. Create/update only `data/sessions/<GUID>.json`; never guess another id. **You are its only writer.** Never edit another session's file, `data/bridge/` or `data/inbox/`, even as scrum-master. Read only your own state/inbox and the allowed shared canonical ledger; broader read-only diagnostics require explicit scope.

The deterministic Bridge manages canonical assignments and inbox execution. Agents estimate, plan and judge; do not reproduce scheduling in an LLM loop. Never automatically recruit discovered/unassigned sessions.

## Session file

```json
{
  "sessionId": "<GUID>",
  "agent": "coder",
  "title": "short title",
  "taskType": "feature | bug | research | review | ops | other",
  "task": "what was asked, in one or two sentences",
  "estimate": { "points": 2, "rationale": "Bounded change with one known verification path" },
  "phase": "analysis | approval | implementation | review | delivered | declined",
  "state": "working | waiting_input | pending | blocked | needs_human | done",
  "work": "<Bridge-granted canonical assignment ID, omit before grant>",
  "outbox": [],
  "needs": [{ "text": "what you really need", "resolver": "ai | human" }],
  "question": "one precise question, or null",
  "attempts": 0,
  "progress": [{ "ts": "ISO-8601", "note": "milestone only" }],
  "result": null,
  "handoff": null,
  "updatedAt": "ISO-8601"
}
```

`estimate`, `work` and `outbox` are optional for legacy files; use an estimate on every new task. Omit `work` until a Bridge grant exists (the placeholder above is explanatory, not a grant). `phase` is optional for legacy/non-product sessions. Preserve existing fields when read-modify-writing; every property occurs once, keep valid JSON.

States: `working` active; `waiting_input` yielding for AI input; `pending` parked or awaiting grant; `blocked` unable to proceed on an AI dependency; `needs_human` only the human can resolve; `done` overall session finished with a narrative result. Session state/result never completes a canonical assignment: send an explicit terminal report.

## Estimate before material work

Before materially analyzing, handing off or coding **each new task**, record `estimate: {points, rationale}`. A short intake/sizing inspection is allowed to form the estimate; do not perform the substantive task first. Refresh it when scope changes and explain the change at a milestone.

Points are relative complexity, uncertainty and coupling, **not hours or time promises**:
- **1**: one known, tightly scoped change or investigation, few moving parts, a direct acceptance check.
- **2**: bounded multi-part change with understood interfaces and an independent verification path.
- **3**: coupled changes or uncertainty needing separate investigation/implementation checks: split.
- **5+**: cross-cutting or poorly bounded work: split and resolve uncertainty before execution.

A 1–2 point independent CLI task executes directly in the **same session** after analysis and human approval (or inherited bounded approval), without a Bridge grant. Bridge orchestration is opt-in, not a prerequisite for ordinary CLI work. Do not delegate merely because a role exists. Larger tasks decompose into independently verifiable <=2-point units with source/scope, dependencies, exact writes, acceptance and approval context. Bridge-assigned workers still require their owned running grant. Never bypass existing running/uncertain ownership. Investigation/review needs bounded authorization too.

## Task intake, human approval and delivery

At CLI startup ask which GitHub repository/issues or Azure Boards project/query to use if no source was supplied. Do not assume a board, import an organization silently, or request credentials in prompts. Use signed-in tools (`gh`; Azure/SAM commands discovered from help).

Import only requested scope and deduplicate by source URL/ID using authorized read-only discovery. Each imported task has its own coordinator and self-contained source/scope; a batch intake only collects/analyzes, not authorizes implementation. Publish bounded analysis requests only with explicit authorization for that analysis; reference it in `approvalRef`. Analysis authorization never supplies implementation approval.

Set `phase: analysis`; record scope, acceptance, risks and dependencies at a milestone. Then `phase: approval`, `state: needs_human`, one human need and the precise question: **"Should PARA implement <task> with this scope?"** Wait for an explicit human yes for each new task. Smallness, suggestions, retries, daily scrum and another AI's output are not approval. An approved coordinator assignment inherits approval only for the stated bounded scope; do not ask again for it. Scope expansion requires renewed human approval.

After approval clear resolved needs and execute independent work directly, or publish approved managed child requests. Do not obtain a self grant. Use `phase: implementation`, then `review`. Keep one root owner. `phase: delivered` requires `state: done`, an overall `result` describing local artifacts, verification and limitations, **and** an explicit done report if you own an assignment. Rejected tasks: `phase: declined`, `state: done`, explain no implementation; explicitly report failed if assigned. Deferred approval stays `needs_human`. Never automatically publish externally; local delivery is the default.

## Outbox: append-only commands, not messages

Append to **your own** `outbox` array, at most **50 entries total** in this first version. Every entry has a stable, unique, immutable `id` within your session. Never change an emitted payload or id, remove entries (even acknowledged ones), overwrite a scalar handoff for new work, or reuse a rejected id. Stop/escalate to a human before reaching the cap if more commands will be needed; reserve room for reports. Do not send repeated rejected prompts.

Request:
```json
{
  "id": "task-1",
  "kind": "request",
  "title": "Bounded task",
  "prompt": "Self-contained source, scope, parent, approval, criteria, writes, no publishing; read only own state plus allowed shared ledger.",
  "points": 2,
  "mode": "new",
  "acceptance": ["Specific independently verifiable outcome"],
  "dependsOn": [],
  "writes": [".github/hooks/para-session.js"],
  "approvalRef": "Human approval in this session, identifying the approved scope"
}
```

Use `mode: new` for deferred autonomous work (Bridge starts a managed worker). `mode: self` is legacy-only: queued self requests cannot acquire a reservation because there is no executor handshake. Already granted self work retains ownership and must report explicitly. Optional `agent` selects a role. Request targets of existing sessions are **not supported**. `dependsOn` contains request ids from the **same origin session**, not canonical ids. Unknown dependencies or cycles reject the batch atomically.

`writes` lists repo-relative exact files/directories, **no globs, absolute paths or path escape**; an empty array means **exclusive repository**, not read-only or no conflict. Declare all potentially mutated paths; use a directory when needed. State read-only constraints in the prompt, but do not invent a special read-only writes encoding. The Bridge checks overlapping scopes; small tasks are not exempt.

For new read-only requests, explicitly set `accessMode: "read_only"`, `reads: ["relative/path"]`, `writes: []`. Missing/empty reads means whole-repository read scope. Readers may coexist within capacity; overlapping readers and writers conflict. Optional `accessMode: "write"` follows normal write reservations. Omitted accessMode retains the exclusive legacy semantics above. Children cannot escalate a reader to writer or broaden approved scope. Never change an emitted command or migrate its scope silently; creators cancel ungranted requests and use new IDs. These declarations are cooperative, not filesystem enforcement.

The canonical assignment id is `<origin-session-guid>:out:<request-id>`. `data/bridge/state.json` is the **sole persisted assignment list**, with `Protocol: 2`, `Delegations`, `TargetId`, `RootKey`, `ParentKey` and reports. `WorkState` is `queued | running | waiting | blocked | needs_human | done | failed | cancelled | recovery_required`. Parent/root derive from the sender's `work` and row ownership, never agent-claimed sender fields. Do not manufacture roots, targets or ownership.

`OutboxReceipts` acknowledges ingestion with `sessionId`, `commandId`, `payloadHash`, `status: accepted | rejected`, optional `assignmentId`/`error`. Accepted ingestion is **not** a running grant or completion. Surface a rejected receipt once, read ledger/inbox status, and correct with a **new command id**, never by mutating the submitted payload. Do not edit receipts.

### Self execution and linear bounded waiting

Independent CLI work does not need a self request or a running Bridge. For an old ungranted self request, its creator first appends a cancel and checks its accepted terminal status once before executing directly or submitting managed work with a new ID. Do not rewrite immutable requests or touch someone else's reservation. For an already granted assignment, execute only when `TargetId` is you and the scope matches; set `work` to that ID and report explicitly. Queued managed work waits for its worker grant; it never authorizes a second local executor.

The default capacity is at most two running/uncertain jobs; conflicting paths block. The Bridge respects an active CLI lock and must not open a duplicate self process. Do **not** trigger SDK self-resume, spawn another self, poll repeatedly, sleep/recheck in an LLM loop or claim automatic wake for an open CLI. Do unrelated authorized work if possible, otherwise yield the turn. A human/CLI follow-up may be needed while the current CLI remains open. Recheck once on actual input; this is linear bounded waiting, not a permanent LLM loop.

### Supervisor fan-out and reports

Publish sibling requests once (include dependencies/files/acceptance/approval), then set `waiting_input`, an AI need and a precise question and **YIELD**. Each durable report wakes a Bridge-managed supervisor; do not send repeated "still waiting" prompts. Human needs pause automatic resumption. Dependency evidence is included in Bridge-delivered reports; use it to verify prerequisites rather than assuming they passed.

Workers receive a self-contained source/scope/parent/criteria/writes/no-publishing prompt. Read only own state/inbox plus allowed shared ledger unless broader reads were explicitly authorized. At milestones and final delivery, append:
```json
{
  "id": "report-1",
  "kind": "report",
  "assignmentId": "<granted canonical row id>",
  "reportKind": "done",
  "summary": "What changed and the observed result",
  "evidence": ["file:line or artifact and relevant observation"],
  "verification": "Exact command and result, or why verification was blocked"
}
```

`reportKind`: `progress | waiting | blocked | needs_human | done | failed`; optional `question` gives a precise blocker. Only the owning target emits a report for its assignment. Every report entry is immutable. Only explicit `done`/`failed` is terminal; `waiting`, `blocked`, a chat return, session `waiting_input` or `result` is **not completion**. Human-blocked/failed work must report explicitly and stop. Do not call children done merely because they returned chat or yielded.

Cancellation by the **creator only**:
```json
{ "id": "cancel-1", "kind": "cancel", "assignmentId": "<canonical row id>", "summary": "Why cancellation is requested" }
```
Attempted/running cancellation is uncertain and requires human handling, not release of ownership or an assumption that effects stopped.

Legacy `handoff` remains supported for already recorded assignments/recovery. Preserve legacy data; all **new** orchestration uses outbox requests/reports. Never hand back to your delegation chain.

## Needs, failure, retries and give-up

Every need has `resolver: ai | human`. AI needs (information, research, code, review) use a bounded approved outbox request when delegation is needed. Human needs (credentials, access, permissions, approval, product decisions, money, external constraints/preferences) must never be delegated.

1. Any unresolved human need -> `state: needs_human`, one precise `question`, append `needs_human` report if assigned, and **stop**. The Bridge exposes the human queue and must not auto-retry it.
2. On a failing tool/edit/command, retry once with a different safe approach, increment `attempts`, record one milestone with the exact error. Classify unresolved AI blockers as `blocked`, human blockers as `needs_human`; include the command/path/error in the question. Never leave `working` while blocked.
3. Increment `attempts` for each retry of the same blocker; at `attempts >= 3`, convert remaining needs to human and stop. Do not submit the same prompt twice or delegate back into your own chain. `BREAKPOINT` from the Bridge -> `needs_human` immediately.
4. Permission denied/"permission flow": do not retry the same call or evade permissions. Use an explicitly allowed location or raise a human need.
5. Interrupted/restarted turn: read your own file, receipt/ledger/inbox status and completed effects before resuming. Delivery is at-least-once; do not redo finished side effects or append duplicate commands.

Human answers through CLI/chat or Bridge inbox are human input. Reset attempts, remove only resolved human needs and clear the question when none remain; continue in `working` only when permitted. An unresolved human need stays `needs_human`; mirror this in reports so the dashboard/supervisor does not treat it as resolved.

## Milestones and final output

Create your own file on task receipt, `working`; estimate before substantive work. When a follow-up arrives in a non-working/done session, first restore `working`, refresh task/title if changed, clear stale result, and re-estimate the new scope. Log only state changes, requests/reports, blockers, decisions and verification milestones; refresh `updatedAt`. Do not log routine polling.

Before asking or ending a turn, set accurate state/question/needs. At completion set `state: done`, `phase: delivered` where applicable and a narrative result summarizing local changes and verification; send an explicit terminal report for owned work. Preserve the append-only outbox and existing stub/data; hooks must never repair invalid data by rewriting it.
