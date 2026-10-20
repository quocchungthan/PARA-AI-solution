---
name: agent-guidance-design
description: Use when creating, extracting, or refactoring agent profiles, instructions, skills, prompts, workflows, or protocols; helps keep reusable guidance portable and non-duplicated.
---

# Agent guidance design

Design guidance so its scope, activation, and source of truth are clear. Reuse portable practices across projects, but keep domain, organization, tooling, and user-specific rules in explicit overlays.

## Choose the right asset

| Asset | Purpose | Include |
|---|---|---|
| Agent profile | Defines a role's expertise and responsibilities | Scope, boundaries, collaboration style, and expected output |
| Instruction | Provides durable context or rules for a repository or task area | Applicability, constraints, conventions, and precedence |
| Skill | Packages a reusable capability for activation when relevant | Trigger, boundaries, procedure, and useful output |
| Prompt | Starts or shapes a specific task | Inputs, bounded request, acceptance criteria, and exclusions |
| Workflow | Describes an ordered process across steps or participants | Sequence, decisions, handoffs, and completion conditions |
| Protocol | Defines invariants for ownership, state, or interaction | Actors, allowed transitions, authority, and failure handling |

An asset can refer to another asset, but should not copy its full source. Keep one canonical definition and link to it. Use the narrowest asset that fits; a prompt should not become a permanent policy, and a role profile should not duplicate a reusable procedure.

## Extract portable guidance

1. Find the original source and check whether equivalent guidance already exists in the target project.
2. Separate general practice from assumptions tied to a domain, codebase, organization, tracker, operating system, tool, or individual.
3. Retain a principle only when it remains useful without those assumptions. Rewrite it in neutral terms rather than copying project-specific examples or commands.
4. Preserve project-specific details as an explicit overlay, not as a universal default. Make precedence and exceptions clear when the base and overlay can differ.
5. Keep the change focused. Prefer a link to the canonical guidance over repeating it in agents, prompts, and instructions.

Potentially portable practices include:

- Investigate existing behavior and prior art before proposing or changing it.
- Ground findings in evidence; distinguish observed facts, inferences, and unresolved questions.
- Prefer adopting established solutions when they fit; build custom capabilities for a clear unmet need, and keep replaceable integrations behind an interface where appropriate.
- Keep changes reviewable, avoid needless duplication, and verify behavior with focused tests or checks appropriate to the change.
- Define role outputs and completion criteria so another participant can use the result without hidden context.

Treat these as decision principles, not automatic mandates. Select only those relevant to the task and preserve the repository's established quality and safety requirements.

## Validate the result

- A reader can tell when the guidance applies and where its authority comes from.
- Examples do not accidentally carry another project's paths, business rules, tools, or permissions into the target.
- Related assets link to one canonical source instead of drifting copies.
- The guidance states meaningful boundaries and verification expectations without promising that cooperative instructions enforce runtime permissions.
