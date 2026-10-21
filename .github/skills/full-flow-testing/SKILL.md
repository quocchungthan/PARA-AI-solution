---
name: full-flow-testing
description: Verify an integrated user journey across relevant application boundaries; use when a change's correctness depends on more than an isolated unit or component.
---

# Full-flow testing

- Identify the user-visible acceptance criteria and the minimal end-to-end path that proves them.
- Discover the project's test/deployment instructions and safe environment. Do not start shared services or containers unless the task allows it.
- Prepare isolated, synthetic data and required dependencies. Confirm the target contains the intended build before exercising it.
- Run the path through its actual integration boundaries; include a key failure or edge case when relevant.
- Capture observable outcomes and distinguish environment/setup blockers from product failures.
- Clean up only test artifacts created for this run when safe. Report path, test data assumptions, result, and untested boundaries.

Do not use a production environment by default or claim full-flow coverage when a layer was mocked or unavailable.
