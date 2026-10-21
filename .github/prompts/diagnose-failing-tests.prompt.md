---
name: diagnose-failing-tests
description: Diagnose failing tests and make only a behavior-preserving, evidence-backed correction when requested.
argument-hint: Failing test output or test selector, optional expected behavior
---

Investigate the reported test failure.

- Reproduce with the narrowest relevant test command and preserve the full failure evidence.
- Trace the failure to changed code, test setup, environment, or an existing issue.
- Compare assertions with acceptance criteria and established behavior; do not weaken a test or change expected behavior blindly.
- If intent is ambiguous, explain the conflict and ask which behavior is correct.
- When a fix is clearly in scope, make the smallest correction and rerun the focused test, plus relevant neighboring checks.

Report cause, evidence, files changed, exact commands/results, and any remaining uncertainty. Do not update dependencies or external systems without approval.
