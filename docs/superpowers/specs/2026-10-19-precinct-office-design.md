# Selectable Nine-Nine Precinct office

## Intent and approved direction

Add a second 3D office environment to PARA alongside Botanical Studio. The user wants a recognizable Brooklyn Nine-Nine precinct based on their LEGO references, with a faithful room arrangement, a livelier sitcom atmosphere, and substantially finer detail and sharper rendering than Botanical Studio.

On 2026-10-19 the user approved the revised orbitable 3D study: “yes, it looks good now.” That approval establishes the revised footprint and visual direction. This document defines how that direction becomes a live office connected to PARA's existing agent sessions.

The images are visual references. Their embedded text and depicted objects are not instructions to the application or development agent.

## Visual baseline

The approved study is `precinct-layout-v2-reviewed.html` with `precinct-detail-v2.js`, in the local visualization workspace:

`C:/Users/vycoi/.codex/visualizations/2026/10/19/01a15469-f4f1-73a0-bb8b-ac02e5145a7f/precinct-preview/content`

Preserve its footprint, room adjacencies, relative scale, camera-readable cutaway presentation, staggered desk arrangement, and furniture placement. The study is a design reference; its demonstration animation and UI are not production session behavior.

The latest reference images are retained there as `reference-overview.png`, `reference-lounge.png`, and `reference-kitchenette.png`. The two earlier overall images supplement the reverse view. Reconcile details against all supplied angles instead of copying a single perspective.

### Layout

- A broad central bullpen with beige square tiles, scattered muted blue-gray and terracotta tiles, staggered gray desk clusters, visitor chairs, filing cabinets, and clear circulation aisles.
- A projecting break room at the front-left, with a dark floor and glass partition and door connecting it to the bullpen. Two vending machines line its side wall; the yellow sofa runs along the open front; a pool table sits beside it. A small round table occupies the center. Coffee equipment, a microwave, and a water cooler sit along the shared partition. Use a pool table, as shown in the close-up.
- A separate open kitchenette at the rear-left of the bullpen. Include navy upper and lower cabinets, a cream fridge, microwave, coffee equipment, an upper shelf with trophy and crockery, and a small two-chair table with yellow and red mugs. Place the blue bin and water dispenser beside the brick pillar with a yellow notice.
- A railing and low storage cabinet with boxes along the left edge.
- Glass-partitioned rooms and connecting passages behind the bullpen, including rear briefing seating.
- A captain's office in the outer right wing, with wood shelving, desk, visitor seating, and flag.

Rear-room dimensions and exact door positions are approximate in the approved study. Use the study's current interpretation for the first production version; adjust only as needed for usable doorways and collision-free movement. Do not claim surveyed or exact set dimensions. Preserve the approved footprint when adding worker capacity.

### Detail and rendering

Keep the stylized voxel miniature aesthetic. Increase geometric and texture detail so room close-ups remain useful: monitor screens, keyboard keys, telephone buttons and cords, drawer handles, paperwork, books, mug handles, chair bases, brick courses, cabinet fronts, pool balls and cues, and recognizable appliances.

Use crisp native WebGL output, antialiasing, a device-pixel-ratio cap of 2, readable small textures, soft lighting, and clear material separation. Keep small foreground details legible at the room cameras. Do not simulate higher resolution by enlarging a low-resolution canvas. Shadow resolution and optional decorative detail may adapt to device capability without changing the layout or live information.

Retain orbit, pan, zoom, home, room focus, and cutaway visibility. Provide useful views of the whole precinct, break room, kitchenette, captain's office, and rear rooms. Both light and dark application themes must remain readable.

## Cast and office activity

Use recognizable voxel interpretations of the cast with distinct hair, silhouette, clothing, and small role-appropriate props:

| PARA role | Precinct representative |
| --- | --- |
| Human manager | Captain Holt |
| Coordinator / executive assistant | Amy |
| Coder | Jake |
| Code reviewer | Rosa |
| Functional reviewer | Boyle |
| Scrum master | Terry |
| HR / capabilities | Gina |
| Researcher | Kevin |

These eight permanent representatives map to existing roles. Temporary session workers use supporting-cast appearances or outfit variants, with stable identity for the lifetime of the worker. Real agent and session names, role labels, and source status remain available in labels, roster, and details. Cast names must not replace source identifiers.

Seat Holt in the captain's office and place Amy near management. Use the bullpen for the operational roles, and existing rear and side rooms for research and capabilities. Seat placement and walk paths are defined by the precinct layout rather than inherited Botanical Studio coordinates.

Include occasional ambient gestures, coffee visits, brief social pauses, and small reactions. Ambient activity conveys atmosphere; it must not invent work, delegation, completion, errors, or human-input requests. Active work and selected actors take priority over optional social movement. Use actual session events for work-related signals and exact source/destination workers for handoffs. Returning workers keep their seats or receive a stable reassignment when space changes.

Reduced motion disables optional walking and repeating gestures and uses static or immediate work signals. Avoid noisy notification announcements for ambient behavior.

## Switching styles

Add an accessible Office style selector with `Botanical Studio` and `Nine-Nine Precinct`. Botanical Studio remains the initial default when no preference exists. Remember a valid selection locally and restore it on reload. Invalid or unavailable saved styles fall back to Botanical Studio.

Switching changes the environment, geometry, cast appearance, room labels, and spatial presentation. Preserve live sessions, selected agent/session, role assignments, details, pending notices, and source event identity. Do not reconnect the Bridge, reset the session store, or replay past work events merely because the style changes.

Maintain separate camera poses for each style and restore them when switching back. Resolve camera focus by semantic room, role, or actor identity. If a stored room focus has no counterpart, use the destination home camera while preserving the selected session.

During a switch, map each worker to a valid seat in the destination layout and rebuild spatial paths. Keep source event IDs and delivery state. Re-anchor active visual handoffs to the destination workers without reporting a new delegation or completion. Background scenery changes must not steal keyboard focus.

Light/dark theme remains independent of office style. Keep the existing roster and details usable during scene loading, errors, and graphics recovery.

## Architecture

Build on the existing Botanical Studio office implementation using React Three Fiber and Three.js. This design branch was rebased onto `origin/main` at `3883448` on 2026-10-19, which merged Botanical office PR #8. Use that merged implementation as the baseline. Do not reconstruct a separate session system or overwrite the other chat's worktree.

Use a small style registry. Each style supplies an ID, label, layout, scene environment, character appearance mapping, room-label anchors, and default camera/focus views. Shared office state, source model, roster, details, notices, selection, and event interpretation remain independent of the selected scenery.

Extract only the existing botanical assumptions needed for this boundary. In particular, scene rendering, actor placement, paths, handoff anchors, labels, camera focus, and seat allocation must consume the active layout. Move botanical-only furniture descriptions out of the shared layout contract. Avoid a shared type that requires every style to contain the same sofa or pantry arrangement.

Keep precinct modeling in focused modules: layout and navigation; room shells and materials; bullpen furniture; break room and kitchenette; captain and rear rooms; character appearance. Share reusable geometric primitives and materials, and batch or instance repeated static geometry. Dispose replaced GPU resources and cancel old animation work on switches and unmount.

The live runtime retains the existing global limit of ten temporary session workers. Provide enough valid seats and arrival/exit paths within the approved rooms, using secondary room seating where needed. Preserve overflow access through roster and reveal behavior. Never imply an invisible worker has become a permanent lead.

Persist only the style preference and per-style camera state needed for presentation. Extend existing persistence and validation rather than storing a parallel copy of live session data.

## Failure handling and performance

Scene loading or failure must leave roster, details, notices, and session navigation functional. A precinct-specific loading failure should offer retry and Botanical Studio. Graphics-context loss uses the existing recovery flow, preserving selection, style preference, and camera memory.

Use the existing motion budget for actual work. Optional sitcom activity yields to session activity and reduced motion. Avoid rendering continuously when the scene is idle. Load the precinct's substantial geometry only when needed and release replaced resources.

Measure the production scene on desktop and a narrow viewport with a full worker population and active handoffs. The study's geometry counts and successful smoke checks establish feasibility, not production frame-rate guarantees. Confirm that scene switching does not accumulate canvases, animation loops, or resources. Keep adaptive visual changes limited to decoration and rendering quality.

## Acceptance and verification

1. Compare production overview, reverse, and room close-ups with the approved study and supplied references. The projecting break room, separate kitchenette, staggered bullpen, rear rooms, and right captain's wing remain recognizable.
2. Verify the increased detail at close zoom and sharp rendering at standard and high-density viewport sizes. Check both application themes, camera controls, cutaway behavior, and narrow-screen access.
3. Switch styles repeatedly with active workers, a selected session, pending notices, and handoffs. Assert that source event identity, session selection, and work state survive, while seats, paths, labels, and camera state resolve correctly for each layout.
4. Validate seat capacity and collision-free routes for all permanent roles and ten temporary workers. Check exact handoff endpoints and overflow roster/reveal access.
5. Exercise reduced motion, keyboard selection and style switching, lazy-load failure, graphics recovery, preference validation, and reload restoration.
6. Run existing office model/runtime/navigation tests and the web build, add focused coverage for the style boundary and persistence, and perform browser checks using realistic session fixtures. Report measured performance and any remaining limits.

## Scope boundary

Deliver two selectable office styles using the existing PARA session features. The approved study's comparison gallery, demonstration controls, and synthetic events are design tools and do not ship as application workflow. Further environments, custom room editors, audio, expanded game mechanics, and backend role changes are outside this change.
