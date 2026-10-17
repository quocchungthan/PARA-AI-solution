# PARA Agent Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add the approved Botanical Studio 3D observation office to PARA, with one floor per main conversation, accurate delegated-worker activity, and the existing graph available alongside it.

**Architecture:** Derive a pure office model from the existing Bridge snapshot, then reconcile stable actors and presentation events independently of the authoritative task state. Accessible React controls and observation details wrap a lazy-loaded React Three Fiber scene with reusable procedural voxel assets, a separate camera controller, and shared light/dark presets. Only the selected floor renders in detail; all floors keep live summaries.

**Tech Stack:** Existing React 19, TypeScript, Vite 6, and Preact signals; Three.js with React Three Fiber stable major 9; Three.js OrbitControls with rotation disabled; Node's test runner with `tsx`; Playwright for browser verification. Use procedural geometry and existing icon/fonts rather than an external model service, physics engine, or animation framework.

**Spec:** [Approved design](../specs/2026-10-17-agent-office-design.md). Read it and its two image references before execution.

**Status:** native execution approved and implemented on 2026-10-17. Final regression and independent whole-branch review are in progress; see the [verification record](../verification/2026-10-17-agent-office.md).

## Global Constraints

- "V1 is an observation experience."
- "One floor represents one **main orchestrator conversation and its whole delegated team**."
- "Up to **ten temporary worker characters per floor**."
- "The human manager is additional: maximum 18 visible characters on a fully populated floor."
- "The other six permanent leads represent departments and aggregate workload. They are not extra backend sessions and do not manufacture task results."
- "The executive assistant directly represents the selected floor's main coordinator session."
- "Data status updates immediately. Presentation movement never delays a task result, attention marker, or selection."
- "Activity on other floors never switches the view automatically."
- "Office / Graph toggle, with Office the default."
- "V1 camera: approved angle locked; pan, zoom, room-label focus, Home reset."
- "Desktop/laptop is the primary target. Smaller screens get a simplified presentation."
- "Respect reduced-motion preferences."
- "The live snapshot remains authoritative. UI animation state never writes task state or session files."
- Preserve the approved lower three-quarter camera and expanded layout; earlier overhead/asymmetric-V/cube experiments are superseded.
- Theme follows the existing application toggle; preserve selection, identity, camera, and activity when it changes.
- No Bridge execution cap, new backend write endpoint, new in-office assignment/reply controls, free rotation, or stacked-floor rendering in V1.

## Review Focus

1. Historical or malformed delegation graphs: reuse, cycles, missing parents, and unknown sessions must not fabricate ownership or hide work. Pinned by Task 1 tests.
2. React StrictMode, rapid snapshot changes, reconnects, and floor changes: identities remain stable and events are not replayed. Pinned by Tasks 2 and 7 tests.
3. Completion during an entrance/exit or a full office: the scene never exceeds ten temporary workers and actual status is immediate. Pinned by Tasks 2, 5, and 6 tests.
4. Failure on the rendering path, including context loss and lazy-chunk errors: the observation list, existing graph, and session navigation remain available. Pinned by Tasks 4 and 8 tests.
5. Constrained panels and competing input handlers: panning must not click an agent, detail focus must remain usable, and the existing reply drawer must not be confused with office observation. Pinned by Tasks 3, 4, and 8 tests.

## Baseline and decisions

Repository inspection found no existing test runner and no installed `web/node_modules` in this worktree. The current lockfile resolves Vite 6.4.4; `web/package.json` uses React 19 and contains a stale package-name/version identity in the lockfile root. Refresh that metadata through normal npm dependency updates rather than manually rewriting the lockfile. Local Node is v24.16.0; the existing publishing workflow uses Node 20.

Use `@react-three/fiber@9`, a compatible stable Three.js release and matching `@types/three`, and `tsx@4`. Resolve the exact versions, confirm their peer/engine compatibility, and save exact versions in the normal npm lockfile at execution. Do not install Fiber 10 prereleases or upgrade the existing React/Vite majors. Avoid Drei: the required controls are available in Three.js and labels remain ordinary accessible HTML. Use Playwright major 1 on Node 24 in a new verification-only workflow; keep the existing publishing workflow and its credentials untouched.

Rationale and official references checked while planning:

- [Fiber introduction](https://r3f.docs.pmnd.rs/) and [v9 compatibility guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide): stable Fiber 9 pairs with React 19.
- [Canvas API](https://r3f.docs.pmnd.rs/api/canvas): orthographic rendering, fallback, DPR, and renderer ownership.
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html): separate navigation controls with rotation disabled in V1.
- [tsx project](https://github.com/privatenumber/tsx): TypeScript execution for Node-based unit checks without changing the app's Vite major.
- [Playwright installation](https://playwright.dev/docs/intro) and [network interception](https://playwright.dev/docs/network): browser verification against controlled snapshot responses.

### Execution conventions

All npm and `npx` commands below run from `web/`; Git commands run from the repository root. A failing test means an observed behavior assertion or missing implementation export, not a broken dependency installation. Install the task's testing dependencies first, then run its new assertion against minimal exported signatures to establish the failure.

At the start of execution, run `npm ci`, `npm run build`, and `npm run build:ui` to record the existing baseline before changing product code. Investigate an existing failure before attributing it to the office. This planning task has not installed dependencies or run product builds.

The checkout is already a managed worktree. Recheck its instructions, status, and branch before execution; reuse it unless isolation is needed. Scope every commit to that task's files. Keep the approved design, visual references, and this plan with the branch. Do not mix user changes into task commits.

## File map

| Files | Responsibility |
| --- | --- |
| `web/src/office/types.ts`, `roles.ts`, `model.ts` | Pure contracts, seven role identities, grouping, health/status summaries |
| `web/src/office/runtime.ts`, `events.ts` | Stable worker identities, capacity, selection, lifecycle/event reconciliation |
| `web/src/office/state.ts` | One signals bridge from existing snapshot/connectivity to the pure runtime |
| `web/src/office/OrchestrationPanel.tsx` | Office/Graph switch; existing graph remains intact |
| `web/src/office/OfficePanel.tsx`, `FloorSelector.tsx`, `OfficeDetails.tsx`, `OfficeRoster.tsx` | Accessible observation UI, notices, session/department details |
| `web/src/office/office.css` | Feature-scoped responsive controls/details/labels styles |
| `web/src/office/layout.ts`, `routes.ts` | World coordinates, rooms, seats, doorways, and walkable paths |
| `web/src/office/scene/OfficeCanvas.tsx`, `SceneBoundary.tsx`, `OfficeCamera.tsx` | Lazy renderer lifecycle, local fallback, fixed-angle camera policy |
| `web/src/office/scene/OfficeScene.tsx`, `RoomShell.tsx`, `Furniture.tsx`, `Plants.tsx` | Reusable procedural floor geometry and furniture |
| `web/src/office/scene/palette.ts`, `Lighting.tsx`, `resources.ts` | Theme presets and shared geometry/material ownership |
| `web/src/office/scene/Character.tsx`, `Actors.tsx`, `motion.ts`, `Labels.tsx`, `Handoffs.tsx` | Voxel actors, movement, projected HTML labels, event effects |
| `web/tests/office/*.test.ts`, `fixtures.ts` | Pure Node-based adapter/runtime/layout checks and reusable synthetic fixtures |
| `web/tests/e2e/office-*.spec.ts`, `snapshotRoute.ts` | Real-browser behavior, rendering and regression checks |
| `web/playwright.config.ts`, `.github/workflows/office-checks.yml` | Isolated browser test server and verification-only CI |
| `web/src/App.tsx` | Replace only Overview's `<Network />` slot with the switchable orchestration panel |
| `web/package.json`, `web/package-lock.json`, `.gitignore` | Necessary dependencies/scripts and test-output ignores |
| `web/README.md`, `docs/superpowers/verification/2026-10-17-agent-office.md` | Usage and observed verification/visual evidence |

Do not export office code from `web/src/ui/index.ts` or `browser.ts`. Do not refactor the existing `Fx.tsx` drawer or `Network.tsx` to implement the office side panel. The current drawer has a reply form and page scrim; office observation uses an in-panel nonmodal aside and links to the existing drawer when requested.

## Shared contracts

Define these once in Task 1; later tasks may add the explicitly identified runtime/scene types, but must preserve these names and meanings. Import `Session`, `Delegation`, and `Snapshot` from `../store` with **type-only imports** in pure modules.

- `OfficeRole`: the seven role names from `.github/agents/`, plus `"unknown"` for a neutral temporary-worker identity.
- `OfficeSelection`: `null | {kind:"session"; floorId:string; sessionId:string} | {kind:"department"; floorId:string; role:OfficeRole} | {kind:"human"; floorId:string}`.
- `SessionPresentation`: `{state:string; activity:"working"|"pending"|"waiting"|"blocked"|"needs-human"|"done"|"unknown"; needsHuman:boolean; healthIssues:readonly string[]; verified:boolean}`. Keep source state and health distinct.
- `DepartmentSummary`: `{role:OfficeRole; sessionIds:readonly string[]; working:number; waiting:number; needsHuman:number; healthIssues:number}`.
- `OfficeFloor`: `{rootId:string; title:string; sessionIds:readonly string[]; departments:readonly DepartmentSummary[]; counts:{working:number; unfinished:number; needsHuman:number; healthIssues:number; failedHandoffs:number}; active:boolean}`. IDs are deduplicated; `active` includes unfinished descendants even when the root is done.
- `OfficeModel`: `{floors:readonly OfficeFloor[]; ungrouped:readonly {sessionId:string; reason:string}[]; sessionsById:ReadonlyMap<string,Session>; delegations:readonly Delegation[]; pendingAssignments:readonly {floorId:string; delegationKey:string; targetId:string}[]}`.
- `Vec3`: `readonly [number, number, number]`; `CameraPose`: `{position:Vec3; target:Vec3; zoom:number}`.
- `OfficeCameraHandle`: `{home():void; focusRoom(roomId:string):void}`. The observation shell owns a React ref to this controller; it is a presentation interface independent of session state.
- `WorkerSlot`: `{sessionId:string; seatId:string; identitySeed:string; phase:"entering"|"seated"|"reporting"|"leaving"; phaseStartedAt:number}`. Source status is read from the current model, not inferred from this phase.
- `OfficeEvent`: `{id:string; floorId:string; kind:"arrive"|"handoff"|"report"|"leave"; sessionId:string; originId?:string; delegationKey?:string; createdAt:number; startedAt?:number}`. Admission sets `startedAt` once; queued age and active-animation elapsed time have separate meanings.
- `FloorRuntime`: `{workers:readonly WorkerSlot[]; queue:readonly OfficeEvent[]; camera:CameraPose|null}`.
- `OfficeRuntime`: `{model:OfficeModel; selectedFloorId:string|null; selection:OfficeSelection; online:boolean; floors:ReadonlyMap<string,FloorRuntime>}`.

Fixture builders in `web/tests/office/fixtures.ts`:

`session(id:string, agent?:string, state?:string, overrides?:Partial<Session>):Session`; `delegation(key:string, originId:string, targetId:string, status?:string):Delegation`; `snapshot(items?:Session[], links?:Delegation[], overrides?:Partial<Snapshot>):Snapshot`.

Fixtures are synthetic and live only under tests. Browser fixtures intercept the existing API before loading the app. Production code never imports test fixtures or adds a demo/live switch.

---

### Task 1: Derive truthful floors and department summaries

**Files:** Create `web/src/office/{types,roles,model}.ts`, `web/tests/office/fixtures.ts`, `web/tests/office/{floors,status}.test.ts`; modify `web/package.json`, `web/package-lock.json`.

**Interfaces:**
- Consumes: existing snapshot/session/delegation types.
- Produces: `deriveOfficeModel(snapshot:Snapshot):OfficeModel`; `presentSession(session:Session):SessionPresentation`; `OFFICE_ROLES:readonly OfficeRole[]` containing exactly seven permanent roles; the shared contracts above.

- [x] **Step 1: Set up the meaningful adapter checks.** Add `tsx@4` as a dev dependency, resolve/save its exact version, and set `test:office` to `tsx --test tests/office/*.test.ts`. Define the fixture builders and contract types. Add these initial assertions:

  ```ts
  test('two roots retain nested delegated work on their own floors', () => {
    const model = deriveOfficeModel(snapshot([
      session('a', 'coordinator'), session('b', 'coordinator'),
      session('c', 'coder'), session('r', 'reviewer'),
    ], [delegation('ac', 'a', 'c'), delegation('cr', 'c', 'r')]));
    assert.equal(model.floors.length, 2);
    assert.deepEqual(new Set(model.floors.find(f => f.rootId === 'a')!.sessionIds), new Set(['a', 'c', 'r']));
    assert.deepEqual(model.floors.find(f => f.rootId === 'b')!.sessionIds, ['b']);
  });
  ```

  Add named tests for shared targets (one ID per floor), a nested coordinator (no extra floor), a coordinator cycle (ungrouped with reason), a missing parent/target, unknown and unregistered roles, duplicate edges, an empty snapshot, and a completed root with unfinished descendants (`active === true`).

- [x] **Step 2: Observe adapter failures.** Run `npx tsx --test tests/office/floors.test.ts tests/office/status.test.ts`. Confirm grouping/status assertions fail against the initial exports.
- [x] **Step 3: Implement the adapter.** Use only `assigned` and `result_fed` relationships with nonempty IDs as ownership edges; retain failures/limits for issue summaries. Detect and quarantine cyclic components before root selection/traversal. Sessions unreachable from a valid coordinator remain in `ungrouped`. Shared targets have multiple legitimate memberships/delegators; do not choose an invented owner. Unknown/unregistered descendants with a known root remain accessible on that floor with a neutral/unverified presentation and additionally appear in the issues/ungrouped list with the reason; do not fabricate a new permanent role.

  Preserve pending target IDs separately without creating worker sessions. Count `needsHuman`, health issues, and failed handoffs distinctly so a stale session does not incorrectly mean the human must answer a question. A done session with historical human needs is not a new request. Floor title precedence: meaningful `title`, first 70 characters of `task`, short ID. Stable list order: active first, then latest root update, then root ID; later runtime selection is independent of this order.
- [x] **Step 4: Pin state semantics.** In `status.test.ts`, assert `working + stale` retains source state and a health marker; `waiting_input` is waiting; unresolved human need on an unfinished session raises `needsHuman`; `done` stays done; `registered:false` is unverified; no synthetic `failed` session state is created from a delegation failure. Run both tests again; expect all assertions to pass.
- [x] **Step 5: Commit** the adapter, test script/lockfile changes, fixtures, and tests: `feat(office): derive conversation floors from bridge snapshots`.

### Task 2: Reconcile worker capacity, identity, and events

**Files:** Create `web/src/office/{layout,routes,runtime,events}.ts`, `web/tests/office/{runtime,events,layout}.test.ts`.

**Interfaces:**
- Consumes: Task 1 model/contracts.
- Produces: `OFFICE_LAYOUT:OfficeLayout`; `createOfficeRuntime(model:OfficeModel, online:boolean, nowMs:number):OfficeRuntime`; `reduceOffice(state:OfficeRuntime, action:OfficeAction):OfficeRuntime`; `collectOfficeEvents(previous:OfficeModel|null, next:OfficeModel, floorId:string, nowMs:number):readonly OfficeEvent[]`; `findRoute(layout:OfficeLayout, from:Vec3, to:Vec3):readonly Vec3[]`.
- Define `OfficeLayout` in `layout.ts`: floor bounds, named room rectangles, role-lead anchors, entry, doors, walk-graph nodes/edges, seats (`id`, `position`, `approach`, `rolePreference`, `reservedFor`), and lounge anchors. Export `OFFICE_LAYOUT`; later geometry reads these same coordinates.
- Define `OfficeAction` in `runtime.ts`: `snapshot` (model, nowMs), `connectivity` (online, nowMs), `selectFloor` (floorId), `select` (selection), `revealWorker` (floorId, sessionId), `camera` (floorId, pose), and `tick` (nowMs).

- [x] **Step 1: Write the failing capacity/identity tests.** Assert a root plus 11 unfinished delegated sessions creates exactly ten worker slots, retains all 11 IDs in model/details, and exposes one excess session through roster calculation. Repeating/reordering a snapshot preserves seat IDs and identity seeds. Selecting an overflow worker replaces the highest-index unselected slot, keeps capacity at ten, and does not claim the displaced worker completed.
- [x] **Step 2: Write transition assertions.** Initial hydration and selection of another floor generate no historical arrivals. A new registered delegated session on the selected floor generates one arrival; identical snapshots generate zero new events. A `result_fed` edge with a blocked target generates a handoff/report of actual status but no successful completion. Done-during-entry, resumed-during-exit, and incoming-work-during-full-capacity never create an eleventh actor. Source status and attention counts change before animation ends. Run `npx tsx --test tests/office/runtime.test.ts tests/office/events.test.ts`; observe failures.
- [x] **Step 3: Define layout and routes.** Start with a 30-by-20-unit rectangular floor, ground `y=0`, rear at negative `z`, management/creative/HR across the rear, research left, pantry right, and four team islands in the foreground. Use at least 16 team seats (four reserved for team leads), two auxiliary research seats, one auxiliary HR seat, dedicated lead/assistant/human anchors, and a connected public circulation graph. Role-preferred seats are chosen first; shared team seats provide overflow, while the global temporary-character cap stays ten. Door/path anchors must lie outside furniture bounds. Include complete wall topology plus V1 cutaway-height metadata for future camera work.

  Implement deterministic shortest routing over the small walk graph; no physics/pathfinding dependency. `layout.test.ts` asserts all temporary seats and lounge/lead anchors can reach the entry via their approach points, no duplicate seat IDs/positions, and no route passes through a wall or furniture rectangle except a declared doorway. Keep room and desk rectangles in layout data so the check is meaningful.
- [x] **Step 4: Implement reconciliation/events.** The root uses the assistant anchor; six role leads have fixed identities; temporary identities derive from session ID. Preserve assignments across polling, theme/floor changes, and reorder. Return departed sessions' results via model history; a missing session is unavailable data, not done. After reconnect, hydrate instead of replaying the gap. Keep only selected-floor presentation events; inactive floors reconcile directly to current state.

  Bound the event queue to 12, allow two transient handoff/movement events concurrently, and drop queued visual events older than 4 seconds. These are presentation limits only. Keep state/history complete. For an arrival burst, admit at most two walking entrances and place remaining new workers at their seats with a brief non-spatial arrival emphasis; do not stack waiting bodies in the doorway. Completion uses up to 1.5 seconds to report, then the actual departure route duration at 2.2 world units/second; if a new live worker needs the last slot, end a decorative exit early. Allow stable re-entry when a done session becomes unfinished. `tick` advances lifecycle deadlines without changing source task state. An unknown-but-recorded session uses the neutral identity; an absent target record does not spawn an invented actor.
- [x] **Step 5: Verify.** Run `npx tsx --test tests/office/runtime.test.ts tests/office/events.test.ts tests/office/layout.test.ts`, then `npm run test:office`. Expect deterministic passes, bounded queues, and ten-or-fewer temporary slots at every tested intermediate state.
- [x] **Step 6: Commit:** `feat(office): reconcile stable workers and presentation events`.

### Task 3: Integrate the accessible observation shell

**Files:** Create `web/src/office/{state.ts,OrchestrationPanel.tsx,OfficePanel.tsx,FloorSelector.tsx,OfficeDetails.tsx,OfficeRoster.tsx,office.css}`, `web/playwright.config.ts`, `web/tests/e2e/{snapshotRoute.ts,office-observation.spec.ts}`; modify `web/src/App.tsx`, `web/package.json`, `web/package-lock.json`, `.gitignore`.

**Interfaces:**
- Consumes: pure model/runtime, `snapshot`, `serviceOnline`, `dark`, `openSession`, `page`, and existing `Network`.
- Produces: `officeRuntime:Signal<OfficeRuntime|null>` and `dispatchOffice(action:OfficeAction):void` from `state.ts`; `OrchestrationPanel():ReactElement`; `OfficePanel():ReactElement` as the DOM shell/roster; `OfficeDetails({runtime,onSelect,onClose,onOpenSession})`; `OfficeRoster({runtime,onSelect,onReveal})`; `FloorSelector({model,selectedFloorId,onSelect})`. Callback types use shared contracts (`onSelect` receives `OfficeSelection`, `onReveal` receives floor/session IDs).

- [x] **Step 1: Establish browser fixtures and failing behavior checks.** Add a compatible exact `@playwright/test` major-1 dev dependency on Node 24. Configure Chromium, Vite at `127.0.0.1:5173`, relative base compatibility, screenshot/trace-on-failure, `testDir: './tests/e2e'`, `testMatch: 'office-*.spec.ts'`, and `test:e2e:office` = `playwright test`. Install Chromium for this test run. `installSnapshotRoute(page, initial:Snapshot)` returns `{setSnapshot(next:Snapshot):void; failSnapshotRequests(value:boolean):void}` and intercepts only the existing snapshot endpoint; any existing inspector request used in regressions gets a clearly synthetic response. Never reach a real local Bridge in these tests.

  In `office-observation.spec.ts`, use accessible assertions: Office selected by default, two root titles in the selector, selected roster limited to that floor, department details contain aggregates, worker details contain the session task/delegators, and no office reply/assignment form exists. These fail against the current graph-only app. Add an `Open session` assertion preserving the existing `#...session=<id>` drawer route.
- [x] **Step 2: Implement the signals adapter and view switch.** A single module-level effect consumes the existing snapshot and connectivity, never polls. On initial data or reconnection use hydration. React StrictMode mounts must not install duplicate observers. `App.tsx` uses `<OrchestrationPanel />` in exactly the current `<Network />` position, leaving Logs and the other pages intact. Office is the initial tab; Graph renders the unchanged existing network. Keep feature state alive across these view switches and the app's offline unmount.
- [x] **Step 3: Implement floor/roster/details controls.** Show active/completed roots, readable fallback titles, working and attention counts, ungrouped reasons, capacity/excess count, every session in a textual list, and history for departed workers. The observation aside is nonmodal and contained in the office panel; it must leave both scene space and roster usable. Human selection explains its visual manager meaning without an invented presence/status. Show plain text from sessions, safe links for evidence actually provided, and no inferred recordings/screenshots. Existing-session navigation first closes office details, then opens the current drawer through `openSession` so the two detail systems do not compete.
- [x] **Step 4: Verify the shell.** Run `npm run test:e2e:office -- --grep "observation"` and `npm run build`. Expect all observation assertions to pass; the viewport region is the accessible office area awaiting the renderer in Task 4, with truthful roster data already useful. Check Graph session clicks still open the current drawer and its existing reply flow.
- [x] **Step 5: Commit:** `feat(office): add floor selection and observation panels`.

### Task 4: Build the Botanical Studio scene and fixed-angle camera

**Files:** Create `web/src/office/scene/{OfficeCanvas.tsx,SceneBoundary.tsx,OfficeCamera.tsx,OfficeScene.tsx,RoomShell.tsx,Furniture.tsx,Plants.tsx,palette.ts,Lighting.tsx,resources.ts}`, `web/tests/e2e/office-scene.spec.ts`; modify `OfficePanel.tsx`, `office.css`, package manifest/lockfile, and `web/vite.config.ts` only if chunk inspection requires it.

**Interfaces:**
- Consumes: `OFFICE_LAYOUT`, selected floor runtime, shared theme signal passed as React props.
- Produces: default export `OfficeCanvas(props:OfficeCanvasProps)` with `{floor:OfficeFloor; floorRuntime:FloorRuntime; model:OfficeModel; theme:"light"|"dark"; reducedMotion:boolean; selection:OfficeSelection; cameraRef:RefObject<OfficeCameraHandle|null>; onSelect:(selection:OfficeSelection)=>void; onCameraChange:(pose:CameraPose)=>void; onTick:(nowMs:number)=>void}`. Task 4 initially renders the static geometry/camera; the later tasks add actors/events through these same props. `RefObject` is a type-only React import.
- `OfficeCamera({layout,pose,onChange,controllerRef,reducedMotion})`, where `controllerRef` exposes `OfficeCameraHandle`; `botanicalPalette(theme:"light"|"dark"):BotanicalPalette`; `OfficeScene({layout,theme,children})`. `BotanicalPalette` defines colors for background, floor, walls, wood, fabric, leaves, labels, semantic statuses, and ambient/key/task light colors and intensities.

- [x] **Step 1: Add scene regression assertions and dependencies.** Resolve stable Fiber 9/Three.js/types peer-compatible versions, add runtime `three`, `@react-three/fiber@9` and dev `@types/three`, save exact versions, inspect `npm ls react react-dom three @react-three/fiber`, and run the existing build. Do not bypass peer conflicts. Add browser checks for a loaded office canvas, Home and room-focus controls, unchanged camera after theme switching, and Graph/list availability when renderer creation fails. Run the new scene tests to observe missing behavior.
- [x] **Step 2: Build reusable real geometry.** Implement shared box/plane/cylinder geometry and materials, instanced repeated foliage/books/chair parts where useful, stone floor, wood desks, glass/timber dividers, proper door gaps, management+assistant office, research library, creative table/board, HR workspace, team islands, pantry coffee/sink/fridge, sofa and lamps. Use the exact layout data, not separate guessed coordinates. Keep full 3D furniture and character-compatible dimensions; concept PNGs are references rather than billboard backgrounds. Rear walls and V1 low foreground walls are driven by topology/cutaway metadata.
- [x] **Step 3: Implement lighting and renderer lifecycle.** Two named palette presets preserve sage/wood identity and distinguish background, floor, walls, fabric, wood, leaves and semantic labels. Use neutral-soft light for day, broad low-intensity cool fill plus warm task lights for night. Start with one shadow-casting key light, shared materials, and DPR capped at 1.5. Lazy-load `OfficeCanvas` through React `lazy`/`Suspense`; keep the shell/list available while loading. A local error boundary and Canvas fallback catch initialization/chunk failures without replacing the entire application. Release owned resources on unmount/context reset; no per-frame allocation of materials/geometries.
- [x] **Step 4: Implement the camera policy.** Start at position `[26,28,40]` toward floor center, then calibrate the same lower three-quarter orientation against the approved layout reference. Fit the full bounds to the actual panel aspect with a 10% margin. Use an orthographic camera and Three.js OrbitControls, `enableRotate=false`, left drag pan, wheel zoom, zoom clamped to 0.6–2.5 times fitted Home zoom. Bind controls to the canvas only; controls must not capture scrolling on the roster or Logs. Store per-floor pose after interaction ends. Room-label focus translates/zooms within the same angle; Home restores fitted full-floor bounds. Camera props remain independent of geometry for future rotation. Treat pointer travel over 4 CSS pixels as navigation rather than actor selection.
- [x] **Step 5: Verify and inspect.** Run `npm run test:e2e:office -- --grep "scene"` and `npm run build`. Capture light/dark static-room screenshots at 1440×900 and 1366×768. Compare to the approved images: camera, expanded room hierarchy, botanical materials, clear paths, visible pantry, and no distortion. Fix visible mismatches before proceeding. Record actual renderer/version choices in the plan/verification notes.
- [x] **Step 6: Commit:** `feat(office): render botanical floor with fixed camera controls`.

### Task 5: Add recognizable characters, seating, and truthful labels

**Files:** Create `web/src/office/scene/{Character.tsx,Actors.tsx,Labels.tsx}`, `web/tests/e2e/office-characters.spec.ts`; modify `OfficeCanvas.tsx`, `office.css`, and runtime/layout only for verified placement defects.

**Interfaces:**
- Consumes: live `OfficeCanvasProps`, role-lead anchors, temporary assignments and session presentations.
- Produces: `Character({identitySeed,role,kind,pose,onSelect})`, with `kind:"human"|"assistant"|"lead"|"worker"` and `pose:"seated"|"standing"`; `Actors(props:OfficeCanvasProps)`; `Labels({anchors,selection,onSelect,onFocusRoom})`. Actor anchors have stable ID, an accessor for their current world position, text, semantic status, and `OfficeSelection`; room anchors instead carry `roomId` and call `onFocusRoom(roomId:string)`, wired to the same `OfficeCameraHandle.focusRoom` as the shell's room controls.

- [x] **Step 1: Write failing browser assertions.** A ten-worker fixture exposes exactly ten temporary-worker selection buttons in the roster and ten worker hit targets/label anchors in the scene, plus seven role identities and one human. The root assistant selects the root task; the coder lead selects department totals; a temporary coder selects its one session. Unknown roles use a neutral worker identity and source explanation. Changing a role's workload must not change its representative's identity. Run `npm run test:e2e:office -- --grep "characters"` and observe failures.
- [x] **Step 2: Implement procedural voxel characters.** Group reusable torso/head/hair/limb parts with stable seeded outfit/hair choices and recognizable lead accessories. Keep proportions consistent with chairs/desks and the approved reference. Model full bodies and all sides; do not restrict assets to a single baked angle. Distinguish human manager and assistant through placement/nameplates rather than fake task counters. Reserved lead seats never become temporary slots.
- [x] **Step 3: Implement scene selection and labels.** Pointer hit targets select through the same callback as keyboard roster buttons. Project label anchors into a positioned HTML overlay; update DOM transforms through refs on frame/camera changes without 60-fps React state writes. Room labels are keyboard-focusable buttons; role/session names use hover/focus or selected emphasis to limit crowding. Keep text at a readable screen size as zoom changes. Source status comes from `presentSession` immediately, even if an actor is entering or leaving. Shift completed worker results to session history without losing inspection access.
- [x] **Step 4: Verify seating/readability.** Run the characters test and pure layout/runtime suites. Capture maximum-population screenshots in both themes: no intersecting chairs/bodies, walls hiding lead faces, duplicate identities for one worker on the selected floor, or labels dependent on color alone. Ensure dragging across an actor pans without opening details.
- [x] **Step 5: Commit:** `feat(office): add role representatives and session workers`.

### Task 6: Animate real arrivals, handoffs, collaboration, and idle behavior

**Files:** Create `web/src/office/scene/{motion.ts,Handoffs.tsx}`, `web/tests/office/motion.test.ts`, `web/tests/e2e/office-animation.spec.ts`; modify `Character.tsx`, `Actors.tsx`, `OfficeCanvas.tsx`.

**Interfaces:**
- Consumes: Task 2 routes/events/runtime and Task 5 actor/label contracts.
- Produces: `samplePath(points:readonly Vec3[], elapsedMs:number, unitsPerSecond:number, reducedMotion?:boolean):{position:Vec3;heading:number;done:boolean}`; `sampleWorkPose(role:OfficeRole, elapsedMs:number):{head:number;leftArm:number;rightArm:number}`; `Handoffs({events,anchors,reducedMotion})`. These sampling helpers are pure; actor refs apply sampled transforms inside the renderer frame loop.

- [x] **Step 1: Pin meaningful motion behavior.** `motion.test.ts` asserts route start/end, no corner-cutting, finite headings on repeated points, and instant destination for a reduced-motion application path. Extend events/runtime checks to assert cancellation when a worker blocks, finishes, or disappears mid-walk. Browser animation tests observe one arrival on a new session, no replay after repeated polls or theme changes, and immediate human-input status during movement. Observe failures before implementing.
- [x] **Step 2: Implement lifecycle movement.** Registered new workers enter from the public doorway and follow graph routes to seat approach points at 2.2 world units/second. Sit/stand transitions are short, role-specific work gestures subtle, and completion reports/departures follow the runtime deadlines. Cap decorative movement to the event policy while seated work/idle loops remain lightweight. A new authoritative state interrupts obsolete movement; an exit may be cut short to preserve capacity. The permanent root assistant may report a result but remains present; only temporary workers depart on session completion.
- [x] **Step 3: Implement hybrid exchange visuals.** Draw short task-card signals along actual observed delegation relationships. Use a worker's actual origin when known, rather than always inventing the root assistant as delegator. For visible, evidence-backed review/report exchanges, let the reporting actor approach the recipient desk using the same routes; keep the event label factual (handoff/report). Do not infer simultaneous joint meetings from two `working` states. Use the creative space for a supported presentation/visit or neutral ambient role-representative behavior, not an invented backend collaboration state.
- [x] **Step 4: Add honest idle behavior and reduced motion.** Department leads may read, stretch, drink coffee, or visit a free lounge anchor only when their department has no unfinished work. Reserve lounge positions deterministically to avoid overlapping actors; other idle leads remain at their desks when lounge seats are full. The human remains a neutral visual manager; no simulated typing/approval attributed to the user. With reduced motion enabled, place actors directly at their appropriate anchors, suppress walking/fidgeting/camera tweening, and preserve state text and short non-spatial emphasis.
- [x] **Step 5: Verify.** Run `npx tsx --test tests/office/motion.test.ts tests/office/events.test.ts tests/office/runtime.test.ts` and the animation browser tests. Exercise completion during entrance, blocking during report, a missed intermediate polling state, and full-capacity replacement. Expect no fabricated completion, no event replay, and no hidden attention until movement ends.
- [x] **Step 6: Commit:** `feat(office): animate observed agent activity and handoffs`.

### Task 7: Finish cross-floor attention and interruption recovery

**Files:** Modify `web/src/office/{state.ts,runtime.ts,OfficePanel.tsx,FloorSelector.tsx,OfficeRoster.tsx,OfficeDetails.tsx}`, `web/tests/office/{runtime,events}.test.ts`; create `web/tests/e2e/office-attention.spec.ts`.

**Interfaces:**
- Consumes: existing `OfficeSelection`/actions and all model counts; no new backend API.
- Produces: `focusOfficeSession(floorId:string,sessionId:string):void` from `state.ts`, which selects the floor, reveals its worker when needed, and opens observation details in one logical action. Existing notification bell semantics stay unchanged; office attention notices live within the office panel.

- [x] **Step 1: Write failing attention/reconnect checks.** On floor A, add a `needs_human` session to floor B: B's badge and its notice update, but selected floor and camera remain A. Clicking the notice selects B and opens the exact question/details. A stale session produces a health issue rather than an invented human question. A worker shared by A and B shows both delegators and never duplicates on one floor. A selected historical/overflow session stays inspectable.
- [x] **Step 2: Test interruption cases with the existing app lifecycle.** Simulate a snapshot outage longer than the app's request timeout and subsequent recovery; local floor/selection/camera persist where IDs still exist, activity resumes without replaying outage events, and missing IDs fall back with an explanation. Repeat mounting through StrictMode and switching Office/Graph and Overview/Sessions. Assert no additional snapshot polling loop, no duplicated arrival, and one active floor canvas at most. Run the new browser test and observe missing behaviors.
- [x] **Step 3: Implement notices and recovery.** Derive notices from current human needs, health issues, and failed/limited handoffs with distinct labels and stable keys. Do not flood the global new-task notifications or auto-switch floors. Acknowledge/dismiss presentation locally while the persistent underlying issue remains visible in floor/status details. Pause old animation claims when offline, cancel stale queued visuals, and hydrate on reconnect. A disappearing selection becomes unavailable with history/reference, not successful completion. If an entire floor vanishes, use a deliberate fallback floor plus an explanatory message.
- [x] **Step 4: Verify.** Run `npm run test:office` and `npm run test:e2e:office -- --grep "attention|reconnect"`. Check that a done root with active descendants still appears as active and cross-floor attention reaches it. Inspect network requests to confirm only the existing snapshot poller is active.
- [x] **Step 5: Commit:** `feat(office): surface floor attention and recover session context`.

### Task 8: Harden accessibility, compact layouts, and rendering fallback

**Files:** Modify office shell/details/roster/CSS, `SceneBoundary.tsx`, `OfficeCanvas.tsx`, `OfficeCamera.tsx`; create `web/tests/e2e/office-accessibility.spec.ts`.

**Interfaces:**
- Consumes: existing shell/actions; media queries for compact screens and reduced motion.
- Produces: a keyboard-complete office experience with graph/session fallback; no new data contracts.

- [x] **Step 1: Write failing browser checks.** At 1440×900, 1366×768, and 390×844, controls do not overlap or overflow. Keyboard users can switch views/floors, select a department/worker, focus a room, reset Home, and close office details with Escape, returning focus to its invoker. Escape only affects the active observation panel; opening the existing drawer closes observation details first. At compact widths below 900 CSS pixels, the scene is opt-in through `Show 3D office`, while summaries/details remain immediately usable. Test renderer initialization failure, lazy import failure, WebGL context loss and retry, and reduced-motion media emulation.
- [x] **Step 2: Implement resilient interaction.** Keep semantic lists/buttons and status text; use nonintrusive live announcements only for meaningful changes. Make observation details nonmodal with an accessible label and deliberate focus behavior. Ensure room controls do not overlap character labels. Compact layout stacks summary/roster/details; the full canvas mounts only on opt-in. Catch scene errors locally and keep a visible `Switch to Graph` action; context loss shows a retry path without losing floor/selection. Dispose/recreate renderer-owned resources only when retry requires it.
- [x] **Step 3: Verify existing flows.** In Graph mode, agent dimming and session drawer links still work. Existing session reply controls continue to use their original endpoint and are not duplicated in the office. Unsupported 3D must not remove Logs or other dashboard tabs. Run the accessibility suite and all office browser tests; inspect dark-theme text and focus outlines manually.
- [x] **Step 4: Commit:** `fix(office): preserve accessible observation across screen and renderer limits`.

### Task 9: Measure, document, and verify the complete experience

**Files:** Create `.github/workflows/office-checks.yml`, `docs/superpowers/verification/2026-10-17-agent-office.md`; modify `web/README.md`, `.gitignore`, and scene resources only where measurements justify changes. Save selected evidence under `docs/superpowers/verification/assets/agent-office/`.

**Interfaces:**
- Consumes: all previous feature contracts and test scripts.
- Produces: passing verification commands, observed performance/visual evidence, usage documentation, and a CI check that never publishes or deploys.

- [x] **Step 1: Run the complete local verification.** From `web/`, run `npm run test:office`, `npm run test:e2e:office`, `npm run build`, and `npm run build:ui`. Confirm actual pass/fail results; keep build output out of Git. Verify the office code/Three.js chunk is lazy, is not exported or bundled through the reusable `dist-ui` entry points, and the existing relative-base deployment still loads chunks correctly. Use a separate production-preview smoke check at a non-root path to catch base-URL asset errors.
- [x] **Step 2: Profile actual maximum load.** Use the ten-worker fixture with the human and all seven representatives, a second floor with attention, and representative polling transitions. On a documented hardware/browser/viewport/DPR combination, measure at least 30 seconds after warmup including pan/zoom and handoffs. Target usable interaction around 30 fps or better. Record frame timing, draw calls, triangles and memory using renderer/browser tools. CI screenshots are visual checks, not a hardware performance benchmark. If needed, instance repeated props, reduce shadow cost/foliage density, lower DPR, or reduce decorative animation; preserve actors, status accuracy, and interactions.
- [x] **Step 3: Capture and inspect release evidence.** Save light/dark overview, selected-worker details, another-floor attention, pantry idle, maximum population, and compact/fallback screenshots. Compare with both approved references for camera, voxel style, botanical palette, expanded team room, clear doors/routes, and dark visibility. Record any visual approximation or unsupported data relation honestly. Do not claim the concept image itself is an implemented scene or claim a browser recording without actually capturing one.
- [x] **Step 4: Add verification-only CI and usage docs.** New workflow runs on relevant pull requests and manual dispatch, uses Node 24, installs from the lockfile, runs pure tests/builds and Chromium browser checks, and uploads failure evidence. Use read-only repository permissions and no publish/deploy steps or secrets. Add usage for Office/Graph, floor grouping, attention, lead-versus-worker meaning, ten-worker display cap, keyboard controls, compact view, reduced motion, and future orbit scope. Document that polling can miss intermediate events and that ambiguous grouping is disclosed rather than inferred.
- [x] **Step 5: Final check and commit.** Run `git diff --check`, re-run only checks affected by any profiling/CI/documentation fixes, and record exact commands/results in the verification note. Commit as `test(office): verify botanical observation experience`. A final branch review should inspect the five Review Focus cases, the approved references, and the measured limitations before integration. No deployment is part of this plan.

## Coverage and handoff

| Spec area | Tasks |
| --- | --- |
| Botanical style, expanded room program, light/dark | 4, 5, 9 |
| Floors, roots, shared/unknown/missing sessions | 1, 3, 7 |
| Human/assistant/department/worker distinction; ten-worker limit | 1, 2, 3, 5 |
| Source-defined role duties and truthful workflow | 1, 3, 5, 6 |
| Hybrid animation, waiting/health/error truth, reduced motion | 2, 6, 7, 8 |
| Office/Graph, floor selection, details, attention, camera | 3, 4, 5, 7 |
| Genuine 3D and future orbit boundaries | 2, 4, 5 |
| Compact screens, keyboard access, renderer/offline fallback | 3, 7, 8 |
| Focused tests, browser evidence, production/UI-package builds, performance | 1–9 |

The first visual milestone is Task 4's actual Botanical Studio room scene. Task 5 adds the complete cast; Task 6 makes the activity live. Execute tasks in order because the adapter, stable assignments, layout, and actor contracts are shared. Task 9 establishes observed acceptance rather than extending scope.

**Recommended execution:** Native implementation in this session with a final independent review. The nine tasks share a tightly coupled scene/data contract, and a single implementer can maintain consistency with less repeated context. Subagent-driven execution is also available if the human prefers independent review at each task boundary. Review this plan and choose the execution method before product implementation.
