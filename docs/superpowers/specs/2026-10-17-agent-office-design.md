# PARA Agent Office: design draft

Date: 2026-10-17

Status: approved by the human for implementation planning and native execution on 2026-10-17. Implementation is present; final verification and independent review are in progress. See the [verification record](../verification/2026-10-17-agent-office.md).

## Purpose

Turn PARA's orchestration overview into a readable, living 3D office. The human should understand who is working, who delegated work, how agents collaborate, and where input is needed. V1 is an observation experience. Later versions may support managing work through the office.

The human is the manager. The main coordinator/orchestrator of a conversation is the manager's executive assistant. Each main conversation has a separate floor; delegated sessions stay on that floor. The Bridge is infrastructure rather than the manager or an agent character.

## Review scope

The sections marked **Confirmed** consolidate decisions made during brainstorming. Sections marked **Proposed defaults** identify the technical defaults included in the draft that the human approved for planning on 2026-10-17. The labels preserve the distinction between interview decisions and engineering proposals. This document specifies behavior and boundaries rather than an implementation sequence or a renderer-library choice.

## 1. Art direction and layout — Confirmed

Use **Botanical Studio**, with the approved chunky 3D voxel aesthetic: squared character heads, stepped hair and foliage, geometric furniture, sage/eucalyptus accents, natural wood, pale stone/mineral flooring, plants, and soft light. Retain the approved lower three-quarter orthographic cutaway camera. The later approved expanded scene supersedes earlier overhead, asymmetric-V, and diamond/cube framing experiments.

The following references have different roles:

- [Botanical Studio light/dark](assets/botanical-studio-light-dark.png): approved materials, colors, light/dark atmosphere, and voxel style.
- [Expanded office layout](assets/expanded-office-layout.png): approved expanded room program, camera orientation, desk capacity concept, and spatial arrangement; apply Botanical Studio materials to it.

These are concept illustrations, not finished 3D models or production-ready interfaces. Earlier pictures label the main office MANAGER because the human/assistant distinction was decided later. The room should now accommodate the human manager and their assistant.

Use an expanded team workspace with multiple collaborative desk islands and spare workstations. Include spacious management/assistant, HR, and research areas, a creative space with a whiteboard and meeting table, and a pantry/lounge with kitchenette, coffee machine, sofa, and coffee table. Provide visible doorways and continuous walking routes. Foreground cutaways keep agents visible. Furnishings and characters share consistent proportions.

Scrum master, coder, reviewer, and functional reviewer belong to the shared team area. Researchers belong to research. HR belongs to its dedicated capability workspace. The assistant works near the human manager. The creative space and pantry are shared facilities.

## 2. Light and dark — Confirmed

Follow the existing application theme switch. Use one scene with two material/lighting presets, preserving floor selection, camera position, character identities, current statuses, and animations through a theme change.

- Light: pale stone, sage, natural wood, neutral-soft daylight, readable dark text.
- Dark: deep forest/graphite surroundings, subdued wood and mineral surfaces, gentle ambient fill, warm task lighting, restrained monitor glow, readable pale text.

Dark mode must keep all rooms and characters visible. Theme names describe visual moods rather than the actual time of day. Status meanings remain consistent across themes.

## 3. Floors and session scope — Confirmed

One floor represents one **main orchestrator conversation and its whole delegated team**, including nested research, coding, and review sessions. A delegated session does not create its own floor simply because it has a session ID. Multiple independent conversations create multiple floors.

Render one floor in detail at a time. A floor selector shows meaningful task titles and activity/attention summaries. Clicking a notice can switch to the relevant floor and open its session details. Activity on other floors never switches the view automatically.

The same human manager owns all floors. A human avatar on the selected floor represents that person, not a separate human per conversation.

### Proposed defaults: grouping real data

The existing snapshot has sessions and directed delegation records but no explicit floor/root ID. Build grouping in a pure adapter with these rules:

1. Treat a coordinator session as a root candidate when it is not a delegated descendant of another coordinator root.
2. Traverse existing delegation links to include descendants, including nested coordinator sessions. Use visited sets and stable session IDs.
3. A worker legitimately reachable from multiple roots can appear in the selected root's view as the same shared session; disclose its multiple delegators in details. Do not fabricate exclusive ownership.
4. Cycles, missing ancestors, unknown roles, unregistered sessions, and standalone non-coordinator sessions must stay accessible through an **Ungrouped sessions** list and the existing Graph/Sessions views. Show the grouping limitation. Do not invent a manager or silently discard records.
5. A delegation with a target ID but no registered target session is an assignment awaiting registration; show that pending relationship in details rather than claiming that a working agent has arrived.
6. Label a floor with the root session's title, falling back to a short task summary and then its short session ID. Keep the selected floor stable as timestamps change. Initial selection prefers the most recently updated unfinished root, then the most recent completed root. If no root exists, show an empty-office explanation and the ungrouped-session list.
7. Keep completed roots available through a completed filter. Do not erase a floor when its root finishes while descendants still need attention.

If derivation cannot reliably identify ownership for the actual data, disclose the limitation and propose the smallest explicit metadata extension during implementation planning. Never infer ownership from matching timestamps, titles, or role names alone.

## 4. Characters and capacity — Confirmed

Use character model **B**:

- Seven permanent role identities: coordinator/assistant, researcher, coder, reviewer, functional reviewer, HR, and scrum master.
- The executive assistant directly represents the selected floor's main coordinator session.
- The other six permanent leads represent departments and aggregate workload. They are not extra backend sessions and do not manufacture task results.
- Every delegated session gets one temporary worker, including delegated sessions whose role happens to be coordinator.
- Up to **ten temporary worker characters per floor**. The human manager is additional: maximum 18 visible characters on a fully populated floor.

Permanent leads remain present when inactive, with gentle idle behavior. Temporary workers have an enter, settle, work/wait, report, and departure lifecycle. Permanent-lead details show department summaries; temporary-worker details show the associated session; the assistant's details show the root session.

Use stable session-to-character identity and desk assignment while a session remains on a floor. Floor selection and repeated snapshots must not randomly change characters or restart arrivals.

### Proposed defaults: capacity and lifecycle edges

- Ten is a visualization capacity, not a limit on execution or delegations in the Bridge. Do not add a backend cap.
- If actual unfinished delegated sessions exceed ten, retain all of them in the floor's session list and show a clear excess count. Keep existing visible assignments stable, and let a user select a non-visible session to inspect or reveal it. Do not silently hide work or expand the office in V1.
- Done sessions remain inspectable after their worker leaves. A session resumed later re-enters with its original identity where practical.
- A missing record in a single snapshot must not animate successful completion. Reconcile disappearance as unavailable data, not a fabricated result.
- Only leads with no active department workload may take relaxed lounge breaks. Waiting, blocked, or stale temporary workers retain an explicit status rather than appearing carefree and idle.

## 5. Role behavior and workflow — Confirmed

Follow the repository's role definitions and actual delegation records. The common workflow is:

Human and assistant brainstorm/design/plan; researchers investigate as needed; coders implement; reviewers review task changes; functional reviewers review the completed application workflow; the assistant integrates results.

This is a typical workflow, not a hardcoded sequence. Coders can request research or review, work can run in parallel, and findings can produce another implementation pass.

| Role | Source-defined responsibility | Office expression |
| --- | --- | --- |
| Coordinator / assistant | Triage, delegate larger tasks, integrate results; may handle small tasks directly | Planning board, receiving/sending task cards, consulting the manager |
| Researcher | Read-only investigation with findings and evidence | Books, investigation screens, findings handoff |
| Coder | Implement and verify features/fixes; delegate when needed | Coding at a workstation, change handoff |
| Reviewer | Report meaningful code/design findings | Shared-screen review, annotated task card |
| Functional reviewer | Exercise actual app workflows and gather browser evidence | Browser/testing station, evidence review |
| HR | Build agent, skill, plugin, and tool capabilities | Capability board and workspace, rather than human hiring |
| Scrum master | Inspect team health, stalls, protocol issues, and coach/intervene | Health board and evidence-backed coaching signals |

Represent the human as the manager without claiming to know their presence, typing, approvals, or actions from the agent snapshot alone. The new office does not itself perform role duties.

## 6. Animation and state — Confirmed

Use a hybrid animation language:

- Routine delegation: short visual task/message signals.
- Supported review/collaboration events: characters may approach a desk or meet in the creative space.
- New temporary workers: enter through a doorway and walk to an available workstation.
- Truly idle leads: coffee, reading, stretching, or lounge breaks.
- Temporary completion: report results and depart.

Data status updates immediately. Presentation movement never delays a task result, attention marker, or selection. Alerts wait for the user's click; they never automatically change floor or camera.

### Proposed defaults: state mapping and evidence

| Source signal | Presentation |
| --- | --- |
| `working`, healthy | Role-appropriate work loop |
| `pending` | Queued/parked marker; no claim of active coding |
| `waiting_input` | Waiting indicator; explain the actual question/delegation in details |
| `blocked` with AI needs | Blocked/dependency indicator at workspace |
| `needs_human`, or an unresolved human need | Human-input marker, floor badge, clickable notice |
| `done` | Result available immediately; short report/depart animation for temporary worker |
| stale, silent, or protocol issues | Health marker that preserves the underlying state |
| failed/limit-reached delegation | Error/limit marker on that relationship, with actual details |
| unknown/unregistered data | Neutral unverified marker and source explanation |

The backend does not currently define a `failed` session state; failed delegation status is separate. A `result_fed` delegation can report waiting/blocked states, so it must not imply a successful completion.

Use snapshot differences to trigger presentation events. Initial load/floor load places existing workers in their current states without replaying historical arrivals and handoffs. Repeated identical snapshots are inert. A `working` state alone supports a work loop, not a claim that two particular agents are simultaneously meeting. Use actual delegation evidence for exchange relationships and neutral handoff animation when concurrent collaboration cannot be established.

Deduplicate events by stable IDs and observed transitions. Bound the presentation queue and coalesce visual bursts while preserving every real event in details. Finish or interrupt obsolete movement when the actual state changes. Switching floors must not accumulate a backlog of old cinematic events.

### Proposed defaults: reduced motion

Respect reduced-motion preferences: retain state labels, selection, notices, and short non-spatial highlights; suppress walking, ambient fidgeting, and animated camera travel. Important information must be available through text/icons as well as color and movement.

## 7. Interaction and integration — Confirmed

- Office / Graph toggle, with Office the default.
- Keep the current graph available for connection inspection.
- V1 camera: approved angle locked; pan, zoom, room-label focus, Home reset.
- Clicking a character opens its observation side panel while the office remains visible.
- Session panel: task/title, actual status, role, delegator(s), progress/recent activity, blockers/questions, result/evidence when available, and an existing-session link.
- Floor badges/attention notices wait for click. Clicking selects the floor and relevant character/details.
- Desktop/laptop is the primary target. Smaller screens get a simplified presentation.

V1 adds no in-office task assignment, agent messaging, approvals, drag-and-drop delegation, or workflow editing. Existing application session/reply features remain available through their existing views.

### Proposed defaults: shell and accessibility

Keep the office within the existing Overview orchestration area, alongside the current Logs panel. Reuse the existing theme signal, snapshot polling, session details/navigation, and visual status vocabulary. Avoid introducing a second independent polling loop.

Provide keyboard-operable Office/Graph controls, floor selector, room controls, Home, and a textual character/session list. Escape closes observation details. On compact screens, prioritize floor/session summaries and details with an optional compact office preview. If 3D rendering is unavailable, offer Graph and session summaries.

## 8. Architecture and future rotation — Confirmed constraints

Build a genuine 3D scene with geometry for rooms, furniture, and characters. Keep camera policy separate so future orbit controls can reuse the scene. Plan for camera-facing labels and camera-dependent wall visibility. V1 exposes only the agreed locked-angle controls.

### Proposed defaults: boundaries

1. **Snapshot adapter:** pure conversion from existing `Session`, `Delegation`, and health fields into floors, department summaries, character assignments, and presentation events.
2. **Office state:** selected floor, selected character, per-floor camera position, stable seat assignments, and short-lived presentation lifecycle state.
3. **Scene:** reusable Botanical Studio geometry, paths, materials, actors, lighting presets, and label anchors. Scene objects consume view models rather than reading backend files.
4. **Animation coordinator:** state-driven loops, paths, bounded exchange events, and reduced-motion behavior.
5. **Application controls:** accessible HTML for view/floor selection, badges, room controls, and details.

Render/animate only the selected floor in detail; compute all floor summaries from the latest snapshot. Reuse the same floor assets across conversations. Instantiate/reuse repeated geometry and materials where practical. Choose the concrete rendering library and dependencies in the implementation plan after checking current compatible versions and repository constraints.

The live snapshot remains authoritative. UI animation state never writes task state or session files. Offline/unavailable data suppresses new success/activity claims and uses the app's offline handling. Preserve selection across a recoverable reconnect where the existing application lifecycle permits it.

Free camera rotation, automatic wall fading for arbitrary views, and simultaneous stacked 3D floors are future extensions. V1 must preserve the model and camera boundaries needed for them without implementing those controls now.

## 9. Verification and acceptance

### Confirmed outcomes

- The approved scene, camera, Botanical Studio style, and light/dark treatments are recognizable.
- Floors correspond to main conversations, with delegated work on the same floor.
- Human manager, root assistant, department representatives, and real temporary workers have distinct, truthful meanings.
- Up to ten temporary workers per floor can be observed and selected.
- Working/waiting/attention/completion are understandable; idle behavior does not conceal blockers.
- Clicking alerts/characters opens the intended context; no automatic attention-driven view jumps.
- Office/Graph, floor selection, pan/zoom, room focus, and Home work.

### Proposed verification scope

- Pure adapter checks: multiple roots, nested delegation, shared targets, missing records, cycles, unregistered sessions, repeated snapshots, initial loading, reactivated sessions, and more than ten workers.
- Transition checks: assignment awaiting registration, task completion versus `result_fed`, health overlays, reconnect, floor switching, and theme switching without duplicate arrivals or lost selection.
- Browser checks with representative fixtures: no work, one worker, ten workers, multiple floors, human needs on another floor, and overflow. Keep fixture/demo data visibly separate from live data.
- Visual checks in both themes at typical desktop/laptop sizes, plus compact layout, keyboard access, reduced motion, and unsupported-3D fallback.
- Profile the selected floor with all 18 characters. Proposed minimum performance target: sustained usable interaction around 30 fps on a documented representative desktop/laptop test environment; measure before claiming it. Prefer fewer decorative effects over misleading or delayed status updates.
- Run the existing web production build. Add focused data/transition tests appropriate to the implementation; avoid tests that merely mirror rendering details.

## 10. Scope boundary and next artifact

This specification and its companion build prompt are design artifacts. The human has approved creating the implementation plan. Product code, dependency installation, asset modeling, backend changes, execution of the plan, and deployment have not started. The next review artifact is the implementation plan.

## Repository evidence

- `.github/agents/*.agent.md`: all seven role definitions.
- `.github/skills/para-session-protocol/SKILL.md`: session state, human needs, and handoff semantics (read as domain documentation for this design).
- `web/src/store.ts`: session/delegation snapshot types, role grouping, polling, navigation, and attention classification.
- `web/src/Network.tsx`: current Bridge -> role -> session graph, maximum four unfinished session nodes per role, and click behavior.
- `web/src/ui/theme.ts`: existing shared light/dark signal.
- `web/src/App.tsx`: Overview graph/log composition and existing drawer.
- `src/Bridge/Api.cs`, `Models.cs`, `SessionStore.cs`, `Scanner.cs`: snapshot shape, discovery, delegation statuses, and result delivery.
