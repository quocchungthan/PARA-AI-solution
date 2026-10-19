# Selectable Precinct Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved detailed Nine-Nine Precinct beside Botanical Studio, preserving PARA's live office behavior when switching styles.

**Architecture:** Share the source model, event interpretation, runtime, roster, and selection. A data-only style registry supplies layout and camera metadata; lazy scene modules supply scenery and cast appearance. Generalize botanical spatial assumptions before connecting the precinct to the live runtime.

**Tech Stack:** Existing React 19, TypeScript, Preact signals, React Three Fiber 9.8.2, Three.js 0.186.1, tsx/node:test, Playwright 1.64.1. No new production dependencies.

**Spec:** [Approved design](../specs/2026-10-19-precinct-office-design.md).

## Global Constraints

- “Preserve its footprint, room adjacencies, relative scale, camera-readable cutaway presentation, staggered desk arrangement, and furniture placement.”
- “Keep the stylized voxel miniature aesthetic.”
- “Use crisp native WebGL output, antialiasing, a device-pixel-ratio cap of 2, readable small textures, soft lighting, and clear material separation.”
- “The live runtime retains the existing global limit of ten temporary session workers.”
- “Real agent and session names, role labels, and source status remain available in labels, roster, and details.”
- “Do not reconnect the Bridge, reset the session store, or replay past work events merely because the style changes.”
- “Light/dark theme remains independent of office style.”
- “Reduced motion disables optional walking and repeating gestures and uses static or immediate work signals.”
- Baseline is merged main `3883448` (Botanical PR #8); current design branch contains only documentation on top. Reuse this isolated worktree after checking the worktree skill; do not modify the other chat's checkout.

## Review Focus

1. Switch during entry, departure, and handoff: preserve source IDs and bounded progress; never synthesize another work event (Task 2).
2. Irregular floor outline and reversed sofa orientation: routes stay on actual floors and approach furniture from the correct side (Task 1).
3. Corrupt storage, nonfinite camera values, or denied localStorage: open a usable default office without throwing (Tasks 2 and 4).
4. Rapid switching during chunk loading, or a failed precinct chunk: latest selection wins; roster and selection stay usable (Task 4).
5. Selected record disappears or connectivity drops during ambient activity: stop optional excursions without fabricating status or retaining orphaned actors (Task 5).

## File and interface map

Paths below are relative to the repository root. Commands run from `web/` unless stated otherwise. Each task ends in a separate local commit; no push, PR, or merge is part of this plan.

| Area | Files and responsibility |
| --- | --- |
| Shared spatial contract | `web/src/office/layout.ts`: layout types and compatibility export; `routes.ts`: floor membership and routes |
| Style data | `web/src/office/styles/types.ts`, `registry.ts`: pure metadata; `styles/botanical/layout.ts`, `styles/precinct/layout.ts`: independent spatial definitions; `styles/precinct/fixtures.ts`: shared furniture placement and collision footprints |
| Botanical-specific data | `styles/botanical/furniture.ts`: sofa/backrest/arms/table dimensions formerly required by the shared layout |
| Style state | `types.ts`, `runtime.ts`, `state.ts`; new `styles/preferences.ts`: validated presentation persistence |
| Shared presentation | `OfficePanel.tsx`, `office.css`, `scene/OfficeCanvas.tsx`, `Actors.tsx`, `OfficeCamera.tsx`, `OfficeScene.tsx`, `Character.tsx`, `resources.tsx` |
| Precinct environment | `styles/precinct/scene.tsx`, `palette.ts`, `resources.tsx`, `primitives.ts`, `shell.ts`, `bullpen.ts`, `breakRoom.ts`, `kitchenette.ts`, `offices.ts` |
| Cast and atmosphere | `styles/precinct/cast.ts`, `scene/ambient.ts`, `scene/AnimationDriver.tsx` |
| Tests and evidence | Existing office tests plus the exact new files identified in each task; final evidence under ignored `web/test-results/office-evidence/` |

All style metadata modules must be safe to import in node:test without DOM, WebGL, React rendering, or scene initialization. Scene code must not be pulled into the initial application chunk through the registry.

### Task 1: Independent layouts and navigation

**Files:** Create the shared style data and botanical/precinct layout files above; modify `layout.ts`, `routes.ts`, `scene/Furniture.tsx`, `scene/Actors.tsx`; update `tests/office/layout.test.ts`; create `tests/office/style-layout.test.ts`.

**Interfaces:** `OfficeStyleId = 'botanical' | 'precinct'`. `OfficeStyleDefinition` contains `id`, `label`, `layout: OfficeLayout`, `labelAnchors: Readonly<Record<string, Vec3>>`, and `views: Readonly<Record<string, OfficeView>>`. `OfficeView` contains `position: Vec3`, `target: Vec3`, and `zoomRatio: number` relative to fitted overview. Export `getOfficeStyle(id: OfficeStyleId): OfficeStyleDefinition` and `isOfficeStyleId(value: unknown): value is OfficeStyleId` from the registry. Add `floorAreas: readonly Rect[]` and `restSeats: readonly { id: string; position: Vec3; approach: Vec3; rotation: number }[]` to `OfficeLayout`; remove `loungeFurniture`, `lounge`, and `loungeApproaches` after migrating consumers. Keep `OFFICE_LAYOUT` as a compatibility export of the botanical layout, with active consumers removed by Task 4.

- [ ] **1. Write failing layout tests.** For each style, assert unique seat IDs and positions, one reserved seat for each of the seven non-unknown roles, at least ten unreserved worker seats, and a separate human position. For every seat approach, rest approach, lead, and human position, route from entry and sample each segment at intervals no greater than 0.1 world units: all circulation samples satisfy `isWalkable`. A reversed rest seat's final segment must pass through its explicit approach. An outdoor point inside overall bounds must fail `isWalkable` for the precinct.

  ```ts
  test('precinct excludes the void beside its projecting lounge', () => {
    const layout = getOfficeStyle('precinct').layout;
    assert.equal(isWalkable(layout, [15, 0, 23]), false);
    assert.ok(layout.seats.filter(s => !s.reservedFor).length >= 10);
  });
  ```
- [ ] **2. Run:** `npx tsx --test tests/office/style-layout.test.ts`. Expect missing registry/types or new navigation assertions to fail.
- [ ] **3. Implement the contract and both layouts.** Move botanical furniture dimensions into its own data file; update current botanical consumers to explicit rest seats and furniture imports. Preserve current botanical positions and tests. Make `isWalkable` require membership in at least one floor area as well as obstacle clearance. Replace the current z-axis-only sofa access inference with explicit rest-seat endpoint matching. Test access in both directions; only the terminal seating segment may enter its furniture footprint.
- [ ] **4. Define precinct layout from the approved model.** Use floor rectangles `(x,z,width,depth)`: bullpen `(0,0,24,18)`, lounge `(0,18,7.4,7.3)`, captain `(24,10,7.4,8)`, side office `(24,3.2,7.4,6.8)`, briefing `(11,-6,13,6)`, and rear rooms `(4,-5,7,5)` and `(0,-5,4,5)`. Keep the six staggered islands and nine bullpen desks from the study. Reserve Holt's human location in the captain's office, Amy nearby, and the six department seats across bullpen and side/rear rooms. Use rear briefing/side-room seating to reach ten temporary seats without widening the footprint. In `fixtures.ts`, export `PRECINCT_FIXTURES: readonly PrecinctFixture[]`, with `PrecinctFixture = { id: string; kind: 'desk' | 'sofa' | 'pool' | 'vending' | 'counter' | 'cabinet' | 'table'; position: Vec3; rotation: number; footprint: Rect }`. Both layout obstacles and scene builders consume these placements. Retain door circulation gaps; entry must connect to the left bullpen aisle rather than require walking across an exterior void. Keep graph nodes slightly inside each floor's exterior edge, while shared interior floor seams remain traversable.
- [ ] **5. Define views and labels.** Registry labels are `Botanical Studio` and `Nine-Nine Precinct`. Preserve semantic room IDs `management`, `team`, `pantry`, `research`, `hr`, `creative` where relevant; add precinct `kitchenette` and `briefing`. Precinct overview uses study position `[43,39,51]`, target `[14,0,9]`; reverse `[-20,37,45]`, target `[14,0,9]`; plan `[14,70,10.001]`, target `[14,0,10]`. Translate study close-up zooms into ratios against its overview: lounge `2.7/1.2`, kitchenette `2.9/1.2`, captain `2.8/1.2`. Preserve corresponding study camera directions and room centers. Bounds fitting replaces the study's fixed browser frustum.
- [ ] **6. Run:** `npx tsx --test tests/office/style-layout.test.ts tests/office/layout.test.ts tests/office/shared-actors.test.ts` and `npm run build`. Expect all to pass, including existing botanical sofa-route checks migrated to its explicit furniture data. Commit as `refactor(office): introduce independent style layouts`.

### Task 2: Preserve live runtime through style changes

**Files:** Modify `types.ts`, `runtime.ts`, `state.ts`, and the camera dispatch call in `OfficePanel.tsx`; create `styles/preferences.ts`, `tests/office/style-runtime.test.ts`, `tests/office/style-preferences.test.ts`; extend `tests/office/shared-runtime.test.ts`.

**Interfaces:** Extend `SharedOfficeRuntime` with `styleId: OfficeStyleId` and `camerasByStyle: Partial<Record<OfficeStyleId, CameraPose>>`; retain `camera` as the active pose for compatibility. Add actions `{ type: 'style'; styleId: OfficeStyleId; nowMs: number }` and `{ type: 'camera'; styleId: OfficeStyleId; pose: CameraPose }`. `createSharedOfficeRuntime(model, online, nowMs, preferences?: OfficePreferences)` defaults to botanical. `OfficePreferences = { version: 1; styleId: OfficeStyleId; camerasByStyle: Partial<Record<OfficeStyleId, CameraPose>> }`. Export `readOfficePreferences(storage: Pick<Storage,'getItem'>): OfficePreferences` and `writeOfficePreferences(storage: Pick<Storage,'setItem'>, preferences: OfficePreferences): void`; storage key is `para-office-presentation-v1`.

- [ ] **1. Write failing tests.** Switch a selected worker from botanical to precinct during entry and departure; assert identical model reference, selection, identity seeds, worker order/count, connectivity, queue IDs/kinds and `createdAt`/`startedAt`, with unique valid destination seats and no arrival/report added. Assert normalized path progress is equal within numerical tolerance and report phase timing is unchanged. Save distinct cameras for both styles and round-trip them. A camera action tagged with the old style must not overwrite the new active camera. Repeating the same style is a no-op. Overflow reveal still protects selection and stays at ten.

  ```ts
  test('switch preserves source state and does not replay work', () => {
    const before = createSharedOfficeRuntime(deriveSharedOfficeModel(populated(10)), true, 0);
    const after = reduceSharedOffice(before, { type: 'style', styleId: 'precinct', nowMs: 100 });
    assert.equal(after.model, before.model);
    assert.deepEqual(after.selection, before.selection);
    assert.deepEqual(after.queue, before.queue);
    assert.equal(after.workers.length, 10);
  });
  ```
- [ ] **2. Write preference tests.** Round-trip valid values; missing/malformed JSON, unknown version/style, invalid vectors, NaN/Infinity, zero/negative zoom, and throwing storage return defaults or drop only the invalid camera. A write failure is swallowed and does not affect runtime state. Reject nonfinite optional `homeZoom`/`viewportWidth` and nonpositive values. New live session IDs are never serialized.
- [ ] **3. Run:** `npx tsx --test tests/office/style-runtime.test.ts tests/office/style-preferences.test.ts`. Expect new API/assertion failures.
- [ ] **4. Implement style-aware allocation and ticks.** Remove the module-level botanical `seats`; get layout from `state.styleId`. On switch, allocate destination seats deterministically in existing worker order, preferring role and remembered valid seat IDs. Preserve identity and source event data. For entering/leaving phases, calculate old path progress `clamp((nowMs-phaseStartedAt)/oldDuration,0,1)` and set the new visual phase start to `nowMs-progress*newDuration`; reporting keeps its start time. Remap all seats before calculating recipient routes. Restore destination camera or null for its home; retain the outgoing camera in its style slot. Reject stale camera actions.
- [ ] **5. Implement persistence in the existing state module.** Load presentation preferences once, pass them into initial runtime creation, and write only when active style or camera references change. Catch storage access errors at the call site too, since acquiring `window.localStorage` can throw. Keep current snapshot/connectivity effects and notice dismissal independent of preferences.
- [ ] **6. Run:** `npm run test:office` and `npm run build`. Expect all tests/build to pass with both style runtimes covered. Commit as `feat(office): preserve runtime across style changes`.

### Task 3: Build the approved detailed precinct scenery

**Files:** Create the listed precinct environment modules and `tests/office/precinct-geometry.test.ts`. Modify `scene/OfficeScene.tsx` and `scene/resources.tsx` only to expose shared scene-owned resource lifetime needed by both environments.

**Interfaces:** Export default `PrecinctScene({ theme, cutaway }: { theme: 'light' | 'dark'; cutaway: boolean }): ReactElement` from `styles/precinct/scene.tsx`. Export pure `buildPrecinctShell(layout: OfficeLayout, palette: PrecinctPalette, cutaway: boolean): PrecinctGeometry` from `shell.ts`. Export `buildBullpen`, `buildBreakRoom`, `buildKitchenette`, and `buildOffices` from their respective files, each with signature `(layout: OfficeLayout, palette: PrecinctPalette): PrecinctGeometry`. In `primitives.ts`, define `PrecinctGeometry = { boxes: readonly Voxel[]; rounds: readonly RoundInstance[]; panels: readonly PanelInstance[] }`, `RoundInstance = { kind: 'cylinder' | 'sphere' | 'torus'; position: Vec3; rotation: Vec3; scale: Vec3; color: string; parameters: readonly number[] }`, and `PanelInstance = { position: Vec3; rotation: Vec3; width: number; height: number; surface: 'glass' | 'monitor' | 'flag' | 'badge' }`. Round parameters follow the corresponding Three geometry constructor's argument order. The builders must not create DOM or GPU resources. Keep procedural textures and GPU allocation in the scene-owned precinct resource provider; reuse existing `VoxelBatch` for opaque boxes.

- [ ] **1. Write a small failing structural test.** Assert shell floor bounds equal the seven approved rectangles; furniture descriptors contain the projecting lounge, six desk islands, pool table, two side-facing vending machines, front sofa, separate navy kitchenette, and outer captain's office. Assert solid furniture footprints come from the same layout entries used for obstacles. These checks pin spatial intent; visual fidelity remains a browser review, not a voxel-count assertion.

  ```ts
  test('break-room fixtures preserve approved orientation', () => {
    const pool = PRECINCT_FIXTURES.find(f => f.kind === 'pool')!;
    assert.deepEqual(pool.position, [5.65, 0, 23.15]);
    assert.equal(pool.rotation, Math.PI / 2);
    assert.equal(PRECINCT_FIXTURES.filter(f => f.kind === 'vending').length, 2);
  });
  ```
- [ ] **2. Run:** `npx tsx --test tests/office/precinct-geometry.test.ts`; expect missing builders to fail.
- [ ] **3. Port the approved study's room and prop construction into the focused builders.** Read `precinct-detail-v2.js` in the spec's visualization directory; reuse its approved measurements, rotations, palettes, and detail hierarchy. Do not copy its WebGL renderer, controls, demo events, DOM buttons, vendor libraries, or global state. Preserve lounge sofa center `(2.6,24.45)` facing inward, pool center `(5.65,23.15)` at rotation π/2, vending centers `(.65,20.1)` and `(.65,21.65)` facing +x, and kitchenette café table `(4.05,4.25)`. Include the spec's detailed appliances, desk clutter, cabinetry, brick courses, glass, briefing seats, shelves, and flags. Exclude later-added navigation adjustments from decorative surfaces only where required for safe passages.
- [ ] **4. Implement batching, resources, and lazy dispatch.** Instance repeated opaque meshes by geometry/material, use vertex/instance colors for palette variation, and share small texture atlases where possible. Keep glass panels separate. Cache static shadows, own and dispose generated geometries/materials/textures, and avoid creating one material per small color detail. Keep lighting readable in both themes, preserve native pixel detail, and expose the existing renderer metrics for final measurement. Add optional `styleId` (default `'botanical'`) and `cutaway` (default `true`) to the existing `OfficeScene` API and dispatch precinct through a dynamic import; leave the live selector for Task 4. Keep shared `SceneResources` above this dispatch so both scenery and actors can consume it and the build actually includes the lazy precinct chunk.
- [ ] **5. Run:** `npx tsx --test tests/office/precinct-geometry.test.ts tests/office/style-layout.test.ts` and `npm run build`. Expect passing structural/navigation tests and a separate precinct scene chunk in the build output. Commit as `feat(office): build detailed precinct environment`.

### Task 4: Connect style selection, cameras, and recovery

**Files:** Modify `OfficePanel.tsx`, `office.css`, `scene/OfficeCanvas.tsx`, `scene/OfficeScene.tsx`, `scene/OfficeCamera.tsx`, `scene/Actors.tsx`, `scene/SceneBoundary.tsx`; create `tests/e2e/office-styles.spec.ts`; update affected actor unit tests.

**Interfaces:** Add `style: OfficeStyleDefinition` to `OfficeCanvasProps`; `describeActors(props)` derives positions/rest rotations from `props.style.layout`. Extend `OfficeCamera` with `views: OfficeStyleDefinition['views']`; extend `OfficeCameraHandle` with `focusView(viewId: string): void` while preserving `home()` and `focusRoom(roomId)`. `OfficeScene` receives `styleId`, `layout`, `theme`, and `cutaway`. Keep scene resources above lazy scenery so actors and handoff anchors retain consistent ownership.

- [ ] **1. Write failing browser cases using `installSnapshotRoute`.** Select a session, dismiss a notice, switch via a keyboard-operable select labeled `Office style`, and assert roster/details/source status stay identical. Save two visibly different camera poses and restore each on round-trip. Reload restores preference. No preference defaults to Botanical. Assert light/dark toggles do not change style, source polling is not restarted by style changes, and selector retains focus. At 390×844, reveal the compact scene and reach selector and room controls without document overflow.

  ```ts
  test('selected session survives style switch', async ({ page }) => {
    await installSnapshotRoute(page, populated(10));
    await page.goto('/');
    await page.locator('.officeSession').filter({ hasText: 'Task worker-0' }).click();
    await page.getByLabel('Office style', { exact: true }).selectOption('precinct');
    await expect(page.getByRole('complementary', { name: 'Office observation' })).toContainText('Task worker-0');
    await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('aria-label', 'Nine-Nine Precinct office scene');
  });
  ```
- [ ] **2. Add async/failure cases.** Delay the precinct chunk, select precinct then botanical, and assert botanical wins without a late stale scene. Abort the precinct chunk: display an accessible failure state with retry and `Use Botanical Studio`; roster/details remain functional. Simulate graphics-context loss in precinct, retry, and preserve style/selection/camera. Seed malformed preferences and deny storage access; confirm a usable default scene.
- [ ] **3. Run:** `npx playwright test tests/e2e/office-styles.spec.ts`; expect selector/style behavior failures.
- [ ] **4. Wire the UI and lazy environments.** Add the two style options to the existing camera-control area, a cutaway checkbox labeled `Cutaway walls`, and precinct overview/reverse/plan controls. Generate room labels/anchors and focus controls from active metadata. Tag camera dispatches with the originating style. Fit camera bounds from active layout and projected height, replacing hardcoded botanical bounds/position; preserve user zoom ratio across resizes and allow all approved close-ups. On first visit, resolve the currently focused semantic room in the destination, falling back to home if absent; on return visits, restore that style's saved camera. Retain this semantic focus in `OfficePanel` state and keep it independent of selected session. Change only spatial presentation on switch, reset old ambient paths, and rebuild actor registry anchors before showing handoffs. Update botanical `RoomShell` to honor the cutaway control using the existing full and cutaway wall heights.
- [ ] **5. Complete scene loading/recovery.** Keep the accessible roster outside scene suspense/error boundaries. Retry a failed lazy import with a fresh loader instance; fallback changes the preferred style explicitly. Key scene-local paths by style, retain the source runtime above the scene, and clean up controls and resources on replacement. Use the current style's name as the canvas accessible label. Remove active `OFFICE_LAYOUT` imports from runtime/panel/scene consumers; compatibility exports remain only for botanical tests.
- [ ] **6. Run:** `npm run test:office`, `npx playwright test tests/e2e/office-styles.spec.ts tests/e2e/office-shared.spec.ts tests/e2e/office-camera.spec.ts tests/e2e/office-orbit.spec.ts tests/e2e/office-accessibility.spec.ts`, and `npm run build`. Expect all passing. Inspect overview/reverse/plan and three close-ups against the approved study before committing `feat(office): add live office style switching`.

### Task 5: Recognizable cast and bounded sitcom activity

**Files:** Create `styles/precinct/cast.ts`, `scene/CharacterAppearance.tsx`, `scene/ambient.ts`, `scene/AnimationDriver.tsx`, `tests/office/precinct-cast.test.ts`, `tests/office/ambient.test.ts`, `tests/e2e/office-precinct.spec.ts`; modify `styles/precinct/scene.tsx`, `scene/Character.tsx`, `Actors.tsx`, `motion.ts`, `OfficeCanvas.tsx`, `resources.tsx`.

**Interfaces:** Export `precinctAppearance(kind: CharacterKind, role: OfficeRole, identitySeed: string): PrecinctAppearance` and `buildPrecinctCharacter(appearance: PrecinctAppearance, pose: 'seated' | 'standing'): readonly RigPart[]` from `cast.ts`; `PrecinctAppearance = { castId: string; skin: string; hair: string; shirt: string; hairStyle: 'short' | 'bald' | 'long' | 'curly'; glasses: boolean; tie: boolean; suspenders: boolean; build: 'regular' | 'broad' }`. `CharacterAppearance.tsx` exports `CharacterRigBuilder = (kind: CharacterKind, role: OfficeRole, identitySeed: string, pose: 'seated' | 'standing') => readonly RigPart[]`, `CharacterAppearanceProvider({ buildRig, children }: { buildRig: CharacterRigBuilder; children: ReactNode })`, and `useCharacterRig(): CharacterRigBuilder | null`. `Character` consumes this optional builder, keeping its current botanical rig as default. `PrecinctScene` accepts optional `children: ReactNode` and wraps both its environment and those actor children with the provider; no precinct implementation is imported into the botanical chunk. Export pure `planAmbientVisit(layout: OfficeLayout, actor: AmbientActor, nowMs: number, seed: number, policy: AmbientPolicy): AmbientVisit | null` from `ambient.ts`. `AmbientActor` has `id`, `position`, `kind`, `status`, `health`, and `selected` matching `ActorDescriptor` plus a boolean selection flag. `AmbientPolicy = { online: boolean; reducedMotion: boolean; busy: boolean }`. `AmbientVisit = { actorId: string; restSeatId: string; outward: readonly Vec3[]; returning: readonly Vec3[]; startedAt: number; dwellAt: number; returnAt: number; endsAt: number }`. No source-model mutation is permitted in this module.

- [ ] **1. Write failing cast tests.** Pin human/coordinator/coder/reviewer/functional-reviewer/scrum-master/hr/researcher to Holt/Amy/Jake/Rosa/Boyle/Terry/Gina/Kevin. Assert deterministic supporting appearance for the same worker seed and distinct main-cast silhouettes. Actor IDs, source labels, selection targets, role, and source status are identical before/after appearance selection.

  ```ts
  test('permanent cast uses the approved role mapping', () => {
    assert.equal(precinctAppearance('human', 'coordinator', 'human').castId, 'Holt');
    assert.equal(precinctAppearance('assistant', 'coordinator', 'lead-coordinator').castId, 'Amy');
    assert.equal(precinctAppearance('lead', 'coder', 'lead-coder').castId, 'Jake');
    assert.deepEqual(precinctAppearance('worker', 'coder', 'worker-0'), precinctAppearance('worker', 'coder', 'worker-0'));
  });
  ```
- [ ] **2. Write failing activity tests.** Use fixed times/seeds to test outward route, dwell, return, safe furniture approach, and seat restoration. At most one optional excursion runs at once, and it starts only with no actual transitions/handoffs. Selected, working, human-input, blocked, and health-affected actors cannot start excursions. Actual work, disconnect, removal, selection, style change, or reduced motion cancels an excursion and restores a valid current-layout position. Assert source model, queue, worker phases, and selection are untouched.
- [ ] **3. Run:** `npx tsx --test tests/office/precinct-cast.test.ts tests/office/ambient.test.ts`; expect missing exports/assertion failures.
- [ ] **4. Implement cast and activity.** Model distinguishing hair, skin, clothes, ties, badges, Terry's build/suspenders, and Kevin's glasses using the existing articulated instancing system. Keep worker appearance seed stable. In precinct, idle representatives remain at home seats until the scheduler admits an excursion; preserve the existing botanical idle-lounge behavior. Permit short gestures and coffee/rest visits from idle representatives, with a stable seeded cooldown of 20–40 seconds and a 3–5 second dwell; preserve current work pose precedence. Stop background paths on interruption rather than walking through old-layout geometry. Keep ambient state local to presentation; labels continue to show source status. Do not add sound or synthetic work messages.
- [ ] **5. Implement bounded rendering.** Set the shared canvas to demand rendering, use `AnimationDriver` to request frames only during actual movement/work poses, camera interaction, or bounded gesture windows, and use cancellable timers to wake the next idle gesture. Reduced-motion static scenes must settle without a continuing frame loop. A screenshot or label update must invalidate correctly even after long idle time. Adjust metrics to record completed renders under demand mode instead of depending on a one-second continuous frame loop.
- [ ] **6. Add browser checks and run:** `npm run test:office`, `npx playwright test tests/e2e/office-precinct.spec.ts tests/e2e/office-animation.spec.ts tests/e2e/office-characters.spec.ts tests/e2e/office-attention.spec.ts`, and `npm run build`. Assert permanent cast IDs and real session labels, two exact session handoff endpoints, reduced-motion interruption, and no stale actor after a disappearing record. Capture cast and break-room evidence and inspect likeness/pose detail. Commit as `feat(office): add precinct cast and sitcom activity`.

### Task 6: Production evidence, resource stability, and regression pass

**Files:** Extend `tests/e2e/office-styles.spec.ts`, `office-precinct.spec.ts`, `office-performance.spec.ts`, `office-resources.spec.ts`, `office-production.spec.ts`; add `docs/office-precinct-validation.md`; update `web/README.md` with selector/camera behavior.

**Interfaces:** Extend existing `SceneMetrics` with completed render count and current style ID for browser assertions, without exposing live session contents. Keep `installSnapshotRoute` as the source of realistic, read-only Bridge fixtures. Existing botanical resource thresholds stay unchanged; precinct metrics are measured separately.

- [ ] **1. Add failing regression cases.** With ten workers plus eight permanent representatives, switch styles twenty times, exercising selection, active events, theme, and room focus. Assert one canvas and no duplicate controls/labels, persistent source event identity, bounded worker count, and stable per-style camera. In a reduced-motion static scene, render count must settle after updates. Compare settled geometry/texture counts on the second and twentieth precinct visits: no increase after warm-up and disposal settling. Aborted lazy loads and retry must not accumulate scene resources.

  ```ts
  // After the fixture-backed switching loop and settled render:
  await expect(page.locator('.officeCanvas canvas')).toHaveCount(1);
  await expect(page.locator('.officeActorLabel[data-kind="worker"]')).toHaveCount(10);
  await expect(page.getByLabel('Office style', { exact: true })).toHaveValue('precinct');
  ```
- [ ] **2. Run the targeted new cases** with `npx playwright test tests/e2e/office-styles.spec.ts tests/e2e/office-resources.spec.ts`; fix resource or lifecycle defects in the owning modules. Expect all assertions passing without weakening existing botanical budgets.
- [ ] **3. Run functional/build verification:** `npm run test:office`, `npm run build`, then `npm run test:e2e:office`. Expect zero failing tests and a successful TypeScript/Vite build. Preserve all existing office behavior, including roster overflow/reveal, attention, exact handoff endpoints, orbit and context recovery.
- [ ] **4. Verify production subpath loading.** Run `npm run build -- --base=/office-check/`; in PowerShell set `$env:OFFICE_PRODUCTION='1'`, run `npx playwright test tests/e2e/office-production.spec.ts`, then remove that task env override. Extend the production test to navigate under `/office-check/`, choose precinct, reload, and recover from a failed precinct chunk. Expect lazy modules and all textures to resolve from the configured base URL.
- [ ] **5. Measure and inspect evidence.** Parameterize the existing 30-second interaction sample for each style, ten workers, real fixture handoffs, and desktop/narrow layouts. Record browser/version, GPU versus software renderer, viewport, DPR, frame intervals, draw calls, triangles, geometries/textures, and idle render behavior. Collect screenshots at 1440×900 and 390×844, both themes, overview/reverse/plan, all room close-ups, cast, selection, and failure states. Compare against the study and the three user images, correcting mismatched room relationships or loss of detail. Use the same hardware/settings for botanical versus precinct measurements; do not claim software-rasterizer timings prove hardware performance.
- [ ] **6. Write validation results and commit.** In `docs/office-precinct-validation.md`, record commands and observed results, screenshots/metrics locations, rendering limits, and the approved approximation of rear-room dimensions. Document usable style selection and independent camera memory in the README. Run `git diff --check` from the repository root. Commit as `test(office): verify precinct style and switching` only after the required checks pass; report any genuinely blocked hardware measurement explicitly rather than substituting a performance claim.

## Plan self-review and handoff

Coverage: Task 1 owns footprint/navigation/capacity; Task 2 owns session truth and persisted presentation; Task 3 owns detailed scenery; Task 4 owns style interaction/cameras/loading/recovery; Task 5 owns cast/motion; Task 6 owns production and measured evidence. Review Focus conditions are pinned in their owning tasks. No product files are changed by this plan.

Recommend native execution in this session because the six tasks share layout/runtime/scene interfaces and benefit from one continuous implementation context. After the user reviews this plan and selects an execution method, use the required execution skill. Native execution includes a fresh whole-branch review at the end; subagent-driven execution uses per-task implementation and review agents. Neither method is started by writing this plan.
