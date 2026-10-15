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

## Dashboard (static web + local API)

`web/` is a React + Vite + signals dashboard (Nexus-style mission control: KPIs, agents, orchestration network, work queue, live activity, runtime logs). It is animated and interactive: KPIs tween and show sparklines, busy agents get a moving border, the network shows particles flowing to agents with running sessions, and changed sessions flash. Click an agent or node to filter, click a card, dot or activity line to open the session drawer (deep link `#session=<id>`, Esc closes), press `/` to search, and filter or pause the logs. Motion is turned off when the OS asks for reduced motion. It always talks to the local Bridge API at `http://localhost:5310` (read-only, started by `dotnet run` in `src/Bridge`; CORS allows `https://quocchungthan.github.io` and any `http://localhost:*`, and it answers Chrome's Private Network Access preflight). If the Bridge is not running (or the browser blocks local-network access, which it asks about once) the page ends in "offline" and tells the user to install and start it.

### Where the UIs live

The public repo `quocchungthan/quocchungthan.github.io` builds all three UIs (its `pages.yml`) and publishes them at the site root:

| App | Deployed URL | Local dev | Backend |
|---|---|---|---|
| Bridge | `https://quocchungthan.github.io/para-bridge/` | `cd web && npm install && npm run dev` → `http://localhost:5173/` | `http://localhost:5310` |
| tools-w-productioncore-aids | `https://quocchungthan.github.io/tools-w-productioncore-aids/` | `http://localhost:5174/` | `http://localhost:5311` |
| tools-s-exploring-local | `https://quocchungthan.github.io/tools-s-exploring-local/` | `http://localhost:5175/` | `http://localhost:5312` |

All builds use a relative base (`./`) and no client router, so the same bundle works on the sub-path and locally. Dev ports are fixed (`strictPort`). `.github/workflows/notify-pages.yml` here asks the host repo to redeploy when `web/` changes (secret `PAGES_DISPATCH_TOKEN`: PAT with Contents: write on `quocchungthan.github.io`; optional, otherwise run the host's Pages workflow manually). Host-repo setup is in its README.

Add to the AFFiNE tools list: add one row to the **Tools** database block (schema: section 9 of `affine-sync-samples.pdf`): Name `PARA Bridge`, Description `Monitor the agent/session cluster. Needs the local Bridge (see README).`, Category `ObserveWatching`, DirectUrl `https://quocchungthan.github.io/para-bridge/`, Id = next free number.

Scripts live in `C:\Users\727124\src\prompts`: `para-start-session.sh <agent>` (new window with a session), `para-run-bridge.sh [--once]`.

Flow: a session writes its file -> sets `handoff` -> bridge starts a new session (or resumes an existing one) -> target finishes (`done`/`waiting_input`/`blocked`) -> bridge sends the result back into the origin session. To feed any session input, add `{ "prompt": "...", "status": "pending" }` to `data/inbox/<id>.json` messages.

Config (optional env vars or `.env`): `PARA_DATA_DIR`, `PARA_POLL_SECONDS`, `PARA_MODEL`, `PARA_DAILY_HOUR` (default 9), `PARA_MAX_DEPTH` (default 3), `PARA_MAX_HANDOFFS` per session (default 5).

Breakpoints: each need is tagged `ai` or `human`. Human-only needs set `needs_human` and are listed in `data/bridge/human-queue.json` (and logged as `WAITING FOR CHUNG`); the bridge never retries them. Agents stop after 3 attempts, and the bridge refuses handoffs beyond the depth/handoff limits and tells the origin to escalate.

Daily: once per day the bridge runs an exclusive catch-up (no handoffs, results or inbox delivery are processed until it finishes): it asks every open session for a catch-up one by one, then runs the `scrum-master` agent, which reviews the log and JSON, intervenes and improves agents/skill/bridge. Entry points: users start sessions with `coordinator`; everything else is bridge-driven.
