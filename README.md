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

## Reusable UI Package (`@quocchungthan/para-ui`) & Seafile Custom CSS

Full documentation (install, React components, Vanilla JS/CSS enhancer, `data-para-*` attributes, and Seafile Custom CSS): **[`web/README.md`](web/README.md)** (also rendered directly on your GitHub Packages page for `@quocchungthan/para-ui`).

`npm run build:ui` in `web/` builds the standalone UI package and Seafile Custom CSS into `web/dist-ui/` (kept separate from `web/dist/` so `para-bridge` deploys untouched). In CI (`.github/workflows/notify-pages.yml`):
- Publishes **`@quocchungthan/para-ui`** to your personal GitHub Packages tab (`para-ui.css`, `para-ui.js`, `para-ui.umd.js`, `react.js`, `index.d.ts`, `seafile-custom.css`).
- Uploads the **`seafile-custom-css`** artifact (`seafile-custom.css` and `seafile-custom.min.css`) on the workflow run (and outputs a copyable block in the Actions summary) so you can paste it directly into self-hosted **Seafile** (**System Admin → Settings / Branding → Custom CSS** or `BRANDING_CSS = 'custom/custom.css'` in `conf/seahub_settings.py`).

## Develop

- UI (React + Vite + signals): `cd web && npm install && npm run dev`, then open http://localhost:5173/.
- Build the UI package & Seafile CSS locally: `cd web && npm run build:ui` (outputs to `web/dist-ui/`).
- Effects from [React Bits](https://reactbits.dev) (ShinyText, MetallicPaint, ClickSpark, FallingText; TS-CSS flavor) are copied into `web/src/reactbits/` and wired up in `web/src/Effects.tsx` and `web/src/ui/`. `ClickSpark` has a `selector` prop so only buttons/links spark. FallingText (with `matter-js`) loads only when the Bridge is offline.
- The public `quocchungthan.github.io` repo builds and publishes all three tool UIs.
- `notify-pages.yml` builds and publishes `@quocchungthan/para-ui`, uploads the `seafile-custom-css` artifact, and triggers a Pages redeploy with the `PAGES_DISPATCH_TOKEN` secret (stored in the `github-pages` environment).
- Helper scripts are in `C:/Users/727124/src/prompts`:
  - `para-start-session.sh <agent>`
  - `para-run-bridge.sh [--once]`

## Functional review video tooling

The `functional-reviewer` agent can use the repo-pinned helper under `tools/review-media/` to record reviewed Playwright flows and render ordered cuts with optional narration audio. On a new machine install Node.js 20+, FFmpeg/ffprobe, then run `npm ci --prefix tools/review-media`, `npm --prefix tools/review-media run install:browser`, and `npm --prefix tools/review-media run doctor`. Usage, safety constraints, timeline format and optional Concat workflow are in [`.github/skills/review-video/SKILL.md`](.github/skills/review-video/SKILL.md). Scripts and pinned dependencies are versioned for cross-machine setup; browser downloads and all generated media stay local and out of Git.

## Optional Concat editor source

The official [jub0t/Concat](https://github.com/jub0t/Concat) source is available as a Git submodule at `third_party/Concat`, pinned to release **v0.2.7** (commit `14b5998d793d90858ac982926374044bba4bf39f`). It is optional: recording/rendering helpers work without it, and normal repo builds do not build Concat.

Initialize it when cloning this repository:

```sh
git clone --recurse-submodules https://github.com/quocchungthan/PARA-AI-solution.git
```

Or initialize it in an existing checkout:

```sh
git submodule update --init --recursive
```

**Quickest way to run:** install the native build for your OS from [Concat v0.2.7 releases](https://github.com/jub0t/Concat/releases/tag/v0.2.7) (Windows, macOS, or Linux), then launch Concat normally. AI models download locally when first used. To enable the review helper, open **Settings → Remote → Remote control** and leave the listener on `127.0.0.1:7420`. Keep the generated token local; provide it as `CONCAT_API_TOKEN` in the process environment when running the helper. Do not expose the API port to a network.

**Build and run from the submodule:** Rust 1.93+, FFmpeg 7+ development libraries, CMake, and a C++ compiler are required. Platform-specific FFmpeg setup and Linux development packages are documented in [`third_party/Concat/src/README.md`](third_party/Concat/src/README.md). Then, from the repository root:

```sh
cd third_party/Concat/src
cargo run -p concat
```

This launches the desktop editor. Enable **Settings → Remote → Remote control** in the window to use the repo's Concat helper. To run the standalone JSON-RPC server instead, use `cargo run -p concat-cli -- serve` from the same `src/` directory and retain its loopback-only default. The repository helper and complete timeline instructions are in [`.github/skills/review-video/SKILL.md`](.github/skills/review-video/SKILL.md).

The submodule retains Concat's AGPL-3.0-or-later license and notices. It points to upstream source; this repository does not modify or relicense it, include its model downloads, or ship a prebuilt app.

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
