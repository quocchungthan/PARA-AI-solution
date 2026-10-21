---
name: review-maintainability
description: Review a scoped diff for maintainability and suggest or apply only approved focused improvements.
argument-hint: Optional diff, file, or scope
---

Review the requested change for meaningful maintainability risks.

- Inspect the diff and relevant callers/tests; distinguish pre-existing issues from problems introduced by this change.
- Look for unclear responsibilities, unnecessary duplication, excessive complexity, weak boundaries, and missing focused tests.
- Report actionable findings with severity, exact path/line, impact, and minimal remedy.
- Do not refactor unrelated code. Apply fixes only when the request explicitly authorizes implementation; preserve intended behavior.
- Run the smallest relevant verification after any approved edit.

Do not require project-specific screenshots, complexity thresholds, lint commands, commits, or pushes unless local instructions or the user require them.
