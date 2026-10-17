# PARA AI solution

This repo coordinates multiple Copilot CLI sessions through JSON files in `data/` (git-ignored) and a .NET bridge.

- Every session MUST follow the `para-session-protocol` skill: keep `data/sessions/<sessionId>.json` current (task, type, state, needs, question, progress, result, handoff).
- Sessions never write another session's file or `data/bridge`. Only `scrum-master` may append pending messages to `data/inbox/<id>.json`.
- Never commit `.env` or anything under `data/`.
- Task-specific scripts and review artifacts stay outside the repo (on the user's Windows machine: `C:/Users/727124/src/prompts`). The reusable, cross-machine Playwright/video helper explicitly requested for this repo lives in `tools/review-media`; generated media and secrets never do.
- Use agents in `.github/agents` for roles (`coordinator`, `coder`, `researcher`, `reviewer`, `scrum-master`, `functional-reviewer`, `hr`); delegate through `handoff`, not by assuming another session shares your context.
