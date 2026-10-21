---
name: generate-test-scenarios
description: Create an evidence-backed, deduplicated scenario inventory from existing tests or supplied requirements.
argument-hint: Optional feature, test path, or scope
---

Generate scenarios for the requested scope.

- Discover relevant tests, requirements, and user flows; record which sources were inspected.
- Derive scenarios from explicit behavior. Mark inference and do not invent product rules.
- Deduplicate equivalent scenarios while preserving traceability to source tests or requirements.
- Include scenario ID, intent, preconditions, steps, expected outcome, source, and useful tags.
- Follow the project's existing scenario format/location; if none exists, propose a local output path before writing.
- Summarize coverage gaps as concrete candidate scenarios, not claims that tests already cover them.

Keep output stable and reviewable. Do not run tests or access a live environment unless asked.
