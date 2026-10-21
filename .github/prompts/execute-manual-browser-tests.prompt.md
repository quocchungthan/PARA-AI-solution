---
name: execute-manual-browser-tests
description: Execute supplied browser scenarios against an explicitly identified safe target and report observed results.
argument-hint: Scenario source, scope, and optional target URL
---

Run the requested browser scenarios only after identifying the intended safe target.

- Resolve the URL/build from the user or current repository instructions; ask if ambiguous or potentially production.
- Check the available browser tool and safe test account/data. Do not assume a framework or credentials.
- For each scenario, record preconditions, steps, expected behavior, observed behavior, status (passed/failed/blocked), and concise evidence.
- Continue after an isolated failure when safe; stop if the target is globally unavailable or an action could cause harm.
- Save results only to the user-approved or project-standard location. Keep credentials, cookies, tokens, and personal data out of artifacts.

Report scenario totals, evidence locations, blockers, target/build, and coverage limitations. Do not modify external systems, submit forms that create real transactions, or claim unobserved success.
