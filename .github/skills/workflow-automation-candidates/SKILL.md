---
name: workflow-automation-candidates
description: Assess repeated work for safe, worthwhile automation; use when a task reveals recurring manual steps or avoidable operator error.
---

# Workflow automation candidates

Observe a workflow before proposing automation.

1. Record repeated steps, stable inputs, decisions, exceptions, current effort, and failure costs.
2. Separate deterministic transformations from judgment, approval, credentials, and external side effects.
3. Check whether existing tools already solve the problem and estimate maintenance burden as well as benefit.
4. Propose the smallest reusable helper with explicit inputs/outputs, validation, dry-run or confirmation behavior, and tests.
5. Keep human gates for decisions and irreversible actions. Implement only when the task is explicitly approved.

Do not create a script simply because a command was used once or automate authorization.
