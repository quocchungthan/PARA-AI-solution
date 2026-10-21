---
name: engineering-quality-review
description: Review a scoped change for correctness, maintainability, and appropriate verification; use before local delivery or when asked to improve reviewability.
---

# Engineering quality review

Review only the requested change and directly related behavior.

1. Read the change and relevant surrounding code, callers, and tests. Preserve unrelated work.
2. Check correctness, boundary/error behavior, duplication, complexity, testability, compatibility, and security-relevant handling where applicable.
3. Compare with local conventions and established tests; do not import another project's lint commands or quality gates.
4. Run the smallest relevant checks, then broader checks only if warranted. Record exact commands and outcomes.
5. Report meaningful findings with severity, path/line, impact, and a concrete fix. If editing was requested, make only the bounded correction and re-verify.

Screenshots, commits, pushes, and external review actions are conditional on the project and explicit user authorization.
