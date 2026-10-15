# PARA Bridge

Watch / observe tool: a mission-control dashboard for a cluster of Copilot CLI agent sessions. Three tabs:
- **Overview**: the interactive orchestration network (left) and the Bridge logs (right).
- **Sessions**: the work queue by state, throughput and health.
- **Agents**: each agent's role, workload and latest signal.

**Open:** https://quocchungthan.github.io/para-bridge/. The page is static and always calls the local Bridge on `http://localhost:5310`.

## Use it

1. Install the [.NET 10 SDK](https://dotnet.microsoft.com/download) and sign in to GitHub Copilot on this machine. No token is needed.
2. Run the Bridge:
   ```
   dotnet run --project src/Bridge
   ```
3. Open the page. If it says offline, allow **local network access** for the site when the browser asks.

Tips:
- Drag, pan and zoom the network. Click an agent node to dim the others, or a session node to open it.
- Click a card to open its session (link: `#view=sessions&session=<id>`, Esc closes it). Press `/` to search.
- The bell next to the theme toggle lights up when a new task enters the work queue. Click the notification to jump to **Sessions** with that task outlined in blue.
- Logs: **ALL** hides DEBUG lines (use the DEBUG filter to see them). INFO lines that report success (`done`, `delivered`, `result_fed`, `assigned ->`, `started`) are shown as green **OK**.
For sessions that need a human, open the card, enter your answer in **Reply to this session**, and send it. The Bridge queues the reply and delivers it on its next scan.

## Register in AFFiNE

On the AFFiNE **Tools** page (it doesn't need to be in any collection), add a row to the `Tools` database block:

| Id | Name | Description | Category | DirectUrl |
|---|---|---|---|---|
| next free | PARA Bridge | Monitor the agent/session cluster. Needs the local Bridge (see README). | ObserveWatching | https://quocchungthan.github.io/para-bridge/ |

Valid categories: `SearchCollect`, `ConvertTransformCompose`, `ObserveWatching`, `CalculatingAnalysing`.

## Develop

- UI (React + Vite + signals): `cd web && npm install && npm run dev`, then open http://localhost:5173/.
- Effects from [React Bits](https://reactbits.dev) (ShinyText, MetallicPaint, ClickSpark, FallingText; TS-CSS flavor) are copied into `web/src/reactbits/` and wired up in `web/src/Effects.tsx`. `ClickSpark` has a small local `selector` prop so only buttons spark. FallingText (with `matter-js`) loads only when the Bridge is offline.
- The public `quocchungthan.github.io` repo builds and publishes all three tool UIs.
- `notify-pages.yml` triggers a redeploy with the `PAGES_DISPATCH_TOKEN` secret (stored in the `github-pages` environment).
- Helper scripts are in `C:\Users\727124\src\prompts`:
  - `para-start-session.sh <agent>`
  - `para-run-bridge.sh [--once]`

## How PARA works

Copilot CLI sessions coordinate through git-ignored JSON files in `data/`:
- `data/sessions/<id>.json`: written only by its own session, following the `para-session-protocol` skill.
- `data/inbox/<id>.json`: input for a session, written only by the Bridge; the dashboard queues human replies here through the local API.
- `data/bridge/state.json`: the Bridge's own bookkeeping.

**Flow:**
1. A session sets `handoff`.
2. The Bridge starts or resumes the target session.
3. When the target reaches `done`, `waiting_input` or `blocked`, the Bridge sends its result back to the origin session.

To feed a session input, add `{ "prompt": "...", "status": "pending" }` to `data/inbox/<id>.json`.

**Limits:**
- Needs tagged `human` go to `data/bridge/human-queue.json` and are never retried.
- Agents stop after 3 attempts.
- Handoffs are refused past `PARA_MAX_DEPTH` (default 3) or `PARA_MAX_HANDOFFS` (default 5).

**Daily:** at `PARA_DAILY_HOUR` (default 9), the Bridge asks recently active, protocol-valid working sessions for a catch-up in parallel (45-second timeout per reply), then runs the `scrum-master` agent (90-second timeout). Working sessions whose `updatedAt` is older than `PARA_STALE_MINUTES` (default 10), and sessions violating required state/question/needs/result fields, are flagged in the dashboard and logs and reported to the scrum master rather than resumed automatically. The Bridge never edits an agent-owned session file. Users start work through the `coordinator` agent.

**Config** (environment variables or `.env`): `PARA_DATA_DIR`, `PARA_POLL_SECONDS`, `PARA_MODEL`, `PARA_STALE_MINUTES`, plus the variables above.

**Providers (all optional):** at startup the Bridge probes each provider and logs which are available (also in `/api/snapshot` as `providers`). Copilot is used when signed in; `ANTHROPIC_API_KEY` (Claude) and `GEMINI_API_KEY` (Gemini) are verified with a metadata-only model-list call, never a billed generation. Antigravity stays disabled until Google documents a callable API or .NET SDK. With no runtime available, the Bridge still serves the dashboard and human queue but does not start or resume sessions. Claude/Gemini are detected only so far; running sessions through them is not implemented yet.
