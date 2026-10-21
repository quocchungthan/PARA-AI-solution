---
name: project-context-resolution
description: Resolve the active repository's conventions, domain vocabulary, architecture, and workflow before specialist work; use when task context is incomplete or a profile must adapt across projects.
---

# Project context resolution

Use this workflow before applying specialist knowledge to a repository. The goal is to discover the active project's context, not to assume that a specialty implies a particular product, stack, or organization.

## Resolve the active workspace

1. Identify the working directory and repository root from the current CLI/workspace context. Use available Git or IDE metadata when useful; do not switch directories or branches.
2. Confirm the repository identity from local metadata such as its remote, root files, project manifests, and user-supplied task. A folder name alone can be stale or ambiguous.
3. Read the closest applicable `AGENTS.md`, `COPILOT.md`, `.github/copilot-instructions.md`, and relevant nested instructions. Follow the most specific current repository guidance.
4. Search only the code, tests, docs, and configuration relevant to the requested change. Prefer current source and tests over remembered descriptions.
5. If ElderVibe memory search is available, search using the verified repository/workspace name, the active folder or known aliases, and the task's domain terms. Treat results as navigation hints, not authority; confirm useful claims against current repository guidance or source.
6. If memory search is unavailable or returns no relevant result, continue with local repository evidence. Do not invent, request, or expose credentials to access memory.

## Source precedence and uncertainty

Use this precedence when context differs: direct user instruction for the current task; applicable repository/parent instructions; current source, tests, and configuration; verified project memory; then general knowledge. A higher-priority instruction does not make inaccessible evidence known. If two applicable sources conflict or a critical detail cannot be verified, state the conflict and ask before consequential work.

Do not assume a remembered project applies merely because a path, machine, stack, or term looks familiar. Use machine identity only when the user or available workspace metadata makes it relevant to selecting local context. Never copy secrets, private customer data, personal details, or unrelated project notes into prompts, reports, or generated artifacts.

## Carry context into specialist work

Summarize only the verified context needed for the task: repository identity, relevant conventions and domain terms, applicable test/verification path, and unresolved assumptions. Keep generic expertise in the specialist profile; keep project-specific findings in the task brief or project overlay. Identify which facts came from current files and which are memory hints when that distinction matters.

## Completion check

- The active repository and applicable instructions were identified rather than guessed.
- Memory informed discovery only when available and relevant; current project evidence was checked.
- No unrelated project, personal, or secret information was carried across workspaces.
- Uncertainty and conflicts are visible in the handoff.
