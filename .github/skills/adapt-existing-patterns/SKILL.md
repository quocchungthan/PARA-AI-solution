---
name: adapt-existing-patterns
description: Find and adapt analogous behavior already present in a codebase; use before implementing a feature that resembles another domain, component, or workflow.
---

# Adapt existing patterns

1. Identify the target behavior and search for analogous flows, including neighboring domains and tests.
2. Compare inputs, outputs, lifecycle, errors, permissions, and side effects. Similar names do not prove equivalent behavior.
3. Reuse a local pattern when its invariants fit. Note necessary differences instead of mechanically copying them.
4. Extract shared code only when multiple callers have genuinely common behavior and a helper makes ownership clearer.
5. Add focused tests for the new path and any shared behavior. Report the references examined and why the chosen pattern fits.

Do not copy project-specific structure into a different stack or force consolidation based on a similarity percentage.
