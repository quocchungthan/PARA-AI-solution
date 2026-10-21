---
name: domain-impact-analysis
description: Trace how a business rule, setting, or shared concept affects its consumers and downstream behavior; use for cross-cutting functional changes.
---

# Domain impact analysis

- Establish intended behavior from requirements and current domain documentation; ask when policy is ambiguous.
- Identify the concept's writers, readers, calculations, state transitions, reports, integrations, and user-visible consumers.
- Trace current code and tests to confirm relationships. Distinguish verified call paths from plausible downstream risks.
- Check compatibility, defaults, existing records, migration/rollout, and regression boundaries.
- Return an impact map, evidence, assumptions, risk-ranked scenarios, and the smallest suitable verification plan.

Do not infer business policy from class names or memory alone, and do not mutate data.
