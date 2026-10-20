---
description: Estimate approved work and publish bounded assignments through the durable session outbox.
---

Follow the `para-session-protocol` skill for: ${input:what:What approved scope should be executed or broken down?}

Record an estimate before substantial analysis or handoff. For 1-2 point work,
execute directly in this approved independent CLI; no Bridge grant is required.
Do not submit self requests. A Bridge-assigned worker must retain its existing grant.
For larger work, append multiple `mode: new` requests of 1-2 points each, with stable
IDs, self-contained scope and approval context, acceptance criteria, dependencies
and write paths. Never overwrite submitted commands or use the legacy scalar
`handoff` for new work.

Set `waiting_input` with a precise question while awaiting child reports, then
yield the turn. The Bridge persists and schedules assignments and routes worker
reports to their creating supervisor. Waiting is not completion; finish only
after explicit reports and acceptance verification. Do not busy-poll, recruit an
unrelated session or bypass human approval. Never automatically publish a PR,
push, merge or close an external work item.
