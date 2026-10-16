---
name: para-session-protocol
description: Protocol for recording task progress, needs, questions, results and handoffs in data/sessions/<sessionId>.json so the PARA bridge can coordinate sessions. Use at the start of every task and whenever state changes.
---

# PARA session protocol

You are one of several Copilot CLI sessions in this folder. The only channel between sessions is JSON under `data/` (git-ignored). A .NET bridge (`src/Bridge`) scans it periodically.

## Your key
Your session id is the GUID at the end of the "Session folder" path in your context (`...\session-state\<GUID>`), or the id the bridge told you. Your file is `data/sessions/<GUID>.json`. **You are its only writer.** Never edit other sessions' files or `data/bridge/`.

## Session file
```json
{
  "sessionId": "<GUID>",
  "agent": "coder",
  "title": "short title",
  "taskType": "feature | bug | research | review | ops | other",
  "task": "what was asked, in one or two sentences",
  "state": "working | waiting_input | pending | blocked | done",
  "needs": [{ "text": "what you really need", "resolver": "ai | human" }],
  "question": "the one question the user/bridge should answer, or null",
  "attempts": 0,
  "progress": [{ "ts": "ISO-8601", "note": "what happened" }],
  "result": "final output, only when done",
  "handoff": null,
  "updatedAt": "ISO-8601"
}
```
States: `working` active; `waiting_input` you finished a turn and need an answer from another AI; `pending` accepted but not started or parked; `blocked` waiting on an AI resolver (a delegation); `needs_human` only Chung can resolve it; `done` finished (fill `result`).

## Who can resolve a need (give-up rule)
Tag every need with a `resolver`:
- `ai`: information, research, code, review, a result another agent/session can produce. Delegate with a `handoff`.
- `human`: credentials, access/permissions, approvals, product decisions, money, anything outside the repo/machine, or a preference only Chung knows. Never delegate these.

Breakpoints, you MUST stop instead of looping:
1. A `human` need exists -> set `state: needs_human`, one precise `question`, stop. The bridge puts it in `data/bridge/human-queue.json` and never retries it.
2. Increment `attempts` each time you retry resolving the same blocker. At `attempts >= 3`, convert the remaining needs to `human` and set `needs_human`.
3. Do not hand off the same prompt twice, and never hand back to a session in your own delegation chain.
4. If the bridge says `BREAKPOINT` (depth or handoff limit), set `needs_human` immediately.
When Chung answers through the CLI/chat or the Bridge inbox, treat either as human input. In your own session file, set `attempts` to 0, remove resolved human needs, and clear `question` when no human need remains; set `state` to `working` and continue. If a human need is still unresolved, keep `state` as `needs_human` and update the single question. The dashboard reads this file, so it will keep showing `needs_human` until you update it.

## When to write
1. On receiving a task: create the file (state `working`).
2. At milestones only (state change, handoff, blocker/question, result, or a notable decision/finding): append one short line to `progress` and refresh `updatedAt`. Do not log routine steps; `progress` is read on demand by humans and the scrum-master, never needed to restore your own context.
3. Before asking anything or ending a turn: set `state`/`question`/`needs`.
4. On completion: `state: done` and `result`.
5. On every new user request or follow-up in a session that is `done` (or otherwise not `working`): FIRST set `state: working`, refresh `task`/`title` if the focus changed, clear `result`, and keep logging `progress`. When the follow-up turn ends, set `state` and `result` again so they describe all the work so far. The bridge stops scanning `done` sessions, so work done under a stale `done` state is invisible to it.
Read-modify-write the whole file; keep it valid JSON. Use only the fields in the schema above.

## Handoff / delegation
To delegate part of the work, set `handoff` (set `state` to `waiting_input` unless you can continue meanwhile):
```json
"handoff": {
  "id": "unique-id-per-handoff",
  "target": "new | <existing sessionId>",
  "agent": "agent name for a new session, e.g. researcher",
  "prompt": "complete, self-contained instructions (the target has none of your context)",
  "reason": "why",
  "wantResult": true
}
```
The bridge starts or resumes the target, and when the target's file reaches `done`/`waiting_input`/`blocked` it sends you the result as a new message in this session.

## Receiving input
Messages from the bridge/user arrive as ordinary prompts, and are logged in `data/inbox/<GUID>.json` (bridge-owned, read-only for you). Resume work, then update your file.
