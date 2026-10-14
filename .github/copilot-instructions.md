# PARA AI solution

This repo coordinates multiple Copilot CLI sessions through JSON files in `data/` (git-ignored) and a .NET bridge.

- Every session MUST follow the `para-session-protocol` skill: keep `data/sessions/<sessionId>.json` current (task, type, state, needs, question, progress, result, handoff).
- Sessions never write another session's file or `data/inbox`, `data/bridge`.
- Never commit `.env` or anything under `data/`.
- Scripts or tools you write for the user are saved under `C:\Users\727124\src\prompts` (user rule), not in this repo.
- Use agents in `.github/agents` for roles; delegate through `handoff`, not by assuming another session shares your context.
