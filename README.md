# PARA Bridge

Watch / observe tool: a mission-control dashboard for a cluster of Copilot CLI agent sessions. Four tabs:
- **Overview**: the interactive orchestration network (left) and the Bridge logs (right).
- **Tasks**: canonical assignments grouped into queued, running/granted, waiting/attention and finished, with scheduling reasons, supervisor/worker links and explicit reports.
- **Sessions**: recorded session phases (not execution status), the session queue by state, throughput and health.
- **Agents**: each agent's role, workload and latest signal.

**Open:** https://quocchungthan.github.io/para-bridge/. The page is static and always calls the local Bridge on `http://localhost:5310`.

## Use it

1. Install the [.NET 10 SDK](https://dotnet.microsoft.com/download) and sign in to GitHub Copilot on this machine. No token is needed.
2. Run the Bridge:
   ```
   dotnet run --project src/Bridge
   ```
3. Open the page. If it says offline, allow **local network access** for the site when the browser asks.

Use the normal runner above for the live team. `dotnet watch` is for isolated
development: automatic restarts can interrupt SDK turns and are not a scheduling
or recovery mechanism. After an update, stop the live Bridge cleanly before
starting its replacement; never run two instances against the same data directory.

Tips:
- Drag, pan and zoom the network. Click an agent node to dim the others, or a session node to open it.
- Click a card to open its session (link: `#view=sessions&session=<id>`, Esc closes it). Press `/` to search.
- The bell next to the theme toggle lights up when a new task enters the work queue. Click the notification to jump to **Sessions** with that task outlined in blue.
- Logs: **ALL** hides DEBUG lines (use the DEBUG filter to see them). INFO lines that report success (`done`, `delivered`, `result_fed`, `assigned ->`, `started`) are shown as green **OK**.
For sessions that need a human, open the card, enter your answer in **Reply to this session**, and send it. The Bridge queues the reply and delivers it on its next scan.

## Task intake and local delivery

Start a **coordinator** CLI session and supply GitHub issue links/repository or an Azure Boards project/query. If you have not chosen a source, the coordinator asks at startup; it uses your signed-in tools rather than asking for tokens. There is no automatic background board importer.

Each task gets a separate coordinator session and follows:

`Analyze -> Your approval -> Implement -> Review -> Delivered locally`

The coordinator records the source, proposed scope, acceptance criteria, risks and dependencies, then stops in `needs_human` with an implementation-approval question. Open the task in **Sessions**, review its progress/scope, choose **Approve implementation** or **Keep for later**, and send the decision. Selecting a button only prepares a reply; sending queues it. The drawer shows pending/delivering/delivered/failed transport status, and the agent changes the task phase only after processing the answer. Duplicate queued human replies are rejected.

Approved bounded assignments can be delegated without asking again for the same scope. Review precedes local delivery; the result must identify local changes/artifacts, verification and limitations. PARA does **not** automatically open a PR, push, merge or close GitHub/Azure work items. These are cooperative agent instructions, not a hard permission sandbox: the Copilot runtime currently approves SDK tool-permission requests. Existing sessions without an explicit phase remain in the regular queue, not falsely marked as delivered product tasks.

## Estimate, break down, report and wait

Every session in this workspace, including plain/unassigned CLI sessions, estimates
its work. Approved independent CLI work executes directly, without a Bridge grant
or a running Bridge. Coordination is opt-in: autonomous delegated work uses
`mode: new`; do not submit self requests. Larger managed work becomes bounded requests in its append-only
`outbox`, with acceptance criteria, dependencies, write scopes and approval context.
The Bridge owns the single canonical assignment list in `state.json` and starts
workers only when scheduling gates permit. Default concurrency is two; uncertain
work retains ownership rather than being silently reassigned. Queued legacy self
requests no longer acquire reservations: their creators cancel them before direct
execution or new managed submissions. Already granted work still needs an owner report.

Read-only managed work explicitly uses `accessMode: "read_only"`, relative `reads`
and `writes: []`. Readers may run together; overlapping readers/writers cannot.
Omitting accessMode retains legacy `writes: []` repository-exclusive behavior.
Never change emitted commands to migrate their scopes.

Workers explicitly report evidence and verification to the supervisor that
created each task. A progress/waiting report or a delivered message is not
completion. Supervisors yield while waiting; the Bridge wakes them for durable
reports instead of keeping an LLM in a polling loop. An attended CLI is not
resumed in a second SDK process, so its user or later safe resume must consume
queued messages.

### Agent guidance assets

PARA distinguishes agent profiles (roles), instructions (durable scoped rules),
skills (reusable capabilities), prompts (bounded task requests), workflows
(ordered procedures), and protocols (ownership/state invariants). When adding or
refactoring guidance, use the [agent-guidance-design skill](.github/skills/agent-guidance-design/SKILL.md)
to keep portable principles separate from project-specific overlays and avoid
duplicated sources of truth.

The [Product Owner](.github/agents/product-owner.agent.md) evaluates goal
alignment, evidence-backed backlog changes, priority tradeoffs and experiment
proposals. PARA-managed 30s work follows the
[canonical 30s goal and participation context](.github/product-context/30s.md)
at bug/feature intake and its other specified decision points. Publication
and reprioritization require an explicitly approved planning batch; live
experiments and implementation need separate approval. This is review guidance,
not an always-running agent, runtime subscription or automatic CLI wake feature.

See **[Durable assignment loop](docs/assignment-loop.md)** for the persisted
architecture, chess-agent lessons, command examples, operating limits and team
breakdown. Existing scalar `handoff` remains compatible; new team work uses
multi-command outboxes. Nothing here bypasses human approval or publishes work.

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
1. A session sets `handoff`; the Bridge persists its target identity, original prompt and agent before execution.
2. The Bridge queues the assignment in a durable inbox, then resumes the target (or creates the saved new target if it does not exist).
3. When the target reaches `done`, `waiting_input`, `blocked` or `needs_human`, the Bridge queues its result back to the origin.
4. The same dispatcher handles assignments, results, recovery, daily prompts and human replies. Delivery is ordered per session; a busy session does not block unrelated sessions.

Use the dashboard reply form for human input; do not edit Bridge-owned inbox/state files while it is running.

**Limits:**
- Needs tagged `human` go to `data/bridge/human-queue.json`. Automated messages do not resume these sessions; a queued human decision can bypass paused automated messages.
- Agents escalate unresolved needs after 3 resolution attempts; the Bridge's transport retries are a separate 5-attempt policy.
- Handoffs are refused past `PARA_MAX_DEPTH` (default 3) or `PARA_MAX_HANDOFFS` (default 5).
- The Bridge retries transient delivery failures with persisted exponential backoff (up to 5 attempts; delays of 15, 30, 60 and 120 seconds between attempts). Saved assignments survive changes to the origin's current handoff. Interrupted delegated work gets at most 3 recovery cycles, with a 10-minute cooldown; restart does not reset the budget. Failed deliveries/delegations surface their errors for human attention.
- A new-target assignment whose Copilot session disappeared can be recreated using its **same saved ID** and prompt. Existing-target messages never create a different session. Legacy delegations without reconstructable original work fail visibly instead of inventing a replacement assignment.
- A writer lease rejects a second updated Bridge using the same data directory. State and inbox writes use flushed temporary files and atomic replacement; unreadable Bridge state is retained rather than reset. Older Bridge binaries do not take this lease: stop the old instance before upgrading.
- Delivery is **at least once**, not exactly once: if the Bridge stops after Copilot receives a prompt but before delivery is recorded, it may send that message again. Retried prompts carry the stable message ID and ask the agent not to repeat completed side effects; delegated work should still be safe to resume.

**Daily:** at `PARA_DAILY_HOUR` (default 9), the Bridge queues catch-ups for recently active, protocol-valid working sessions (45-second timeout per reply), then queues `scrum-master` after those messages finish or exhaust retries (90-second timeout). Daily work uses the normal dispatcher and does not exclusively block normal work. The day is marked complete only after scrum delivery succeeds; failures retain bounded retry state. Stale/invalid standalone sessions are flagged, not blindly resumed. Assigned delegated work can receive bounded recovery when it has no recent event activity. The Bridge never edits an agent-owned session file. Users start work through the `coordinator` agent.

**Config** (environment variables or `.env`): `PARA_DATA_DIR`, `PARA_POLL_SECONDS`, `PARA_MODEL`, `PARA_STALE_MINUTES`, plus the variables above.

**Providers (all optional):** at startup the Bridge probes each provider and logs which are available (also in `/api/snapshot` as `providers`). Copilot is used when signed in; `ANTHROPIC_API_KEY` (Claude) and `GEMINI_API_KEY` (Gemini) are verified with a metadata-only model-list call, never a billed generation. Antigravity stays disabled until Google documents a callable API or .NET SDK. With no runtime available, the Bridge still serves the dashboard and human queue but does not start or resume sessions. Claude/Gemini are detected only so far; running sessions through them is not implemented yet.
