---
name: triage-review-feedback
description: Analyze review comments against the current change and propose bounded responses or fixes.
argument-hint: Review comments or thread references, optional diff scope
---

For each supplied review comment:

1. Read its exact context and relevant diff/callers/tests.
2. Classify it as a defect, clarification, disagreement, duplicate, or out-of-scope suggestion.
3. Support the assessment with evidence and draft a concise reply.
4. If a code change is warranted, define the minimal local scope and ask for approval when not already explicit.
5. Report which comments remain unresolved and why.

Treat PRs and issue trackers as read-only unless the user explicitly approves a specific external write. Never automatically post replies, resolve threads, commit, push, merge, or close work.
