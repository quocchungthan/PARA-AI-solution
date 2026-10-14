# PARA AI solution

Multiple Copilot CLI sessions coordinate through JSON files; a small .NET bridge (Copilot SDK, uses your local Copilot sign-in, no token) reads them and delegates/resumes sessions.

```
.github/            agents, skills (para-session-protocol), prompts, copilot-instructions
data/               git-ignored JSON channel
  sessions/<id>.json  written by the agent session only (task, type, state, needs, question, progress, result, handoff)
  inbox/<id>.json     written by the bridge only (input fed to a session + its response)
  bridge/state.json   bridge bookkeeping (seen handoffs, open delegations)
src/Bridge/         the scheduled scanner
```

Scripts live in `C:\Users\727124\src\prompts`: `para-start-session.sh <agent>` (new window with a session), `para-run-bridge.sh [--once]`.

Flow: a session writes its file -> sets `handoff` -> bridge starts a new session (or resumes an existing one) -> target finishes (`done`/`waiting_input`/`blocked`) -> bridge sends the result back into the origin session. To feed any session input, add `{ "prompt": "...", "status": "pending" }` to `data/inbox/<id>.json` messages.

Config (optional env vars or `.env`): `PARA_DATA_DIR`, `PARA_POLL_SECONDS`, `PARA_MODEL`, `PARA_DAILY_HOUR` (default 9).

Daily: once per day the bridge runs an exclusive catch-up (no handoffs, results or inbox delivery are processed until it finishes): it asks every open session for a catch-up one by one, then runs the `scrum-master` agent, which reviews the log and JSON, intervenes and improves agents/skill/bridge. Entry points: users start sessions with `coordinator`; everything else is bridge-driven.
