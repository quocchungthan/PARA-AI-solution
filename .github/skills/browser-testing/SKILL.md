---
name: browser-testing
description: Plan and execute safe browser-based functional or exploratory tests; use when behavior must be observed in a rendered application.
---

# Browser testing

1. Resolve the target application/build, URL, account, test data, and available browser tool from project guidance; ask if a safety-critical prerequisite is missing.
2. Convert requirements into scenarios with preconditions, user steps, and expected outcomes.
3. Exercise the UI through the available browser automation. Do not substitute direct API calls or source reading for a UI assertion.
4. Record actual observations and minimal evidence. Mark each scenario passed, failed, or blocked; do not infer unobserved results.
5. Reproduce failures safely and capture actionable steps. Report environment, coverage limits, and evidence location.

Do not assume a browser, test framework, live deployment, credentials, or a need for screenshots. Avoid destructive or production-mutating actions without explicit approval.
