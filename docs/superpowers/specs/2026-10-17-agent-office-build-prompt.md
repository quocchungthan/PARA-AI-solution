# PARA Agent Office: reusable build prompt

Status: companion design approved for implementation planning on 2026-10-17. Review the resulting implementation plan before execution.

---

Design and implement a 3D Agent Office observation view for the existing PARA Bridge web dashboard. Use the reviewed specification at `docs/superpowers/specs/2026-10-17-agent-office-design.md` as the detailed contract. Follow repository instructions, inspect the current application, and preserve its session and Bridge semantics. Resolve any conflict with explicit human instructions before implementation.

## Intended experience

The user is the human manager. The main coordinator/orchestrator in a conversation is their executive assistant. One main conversation and its entire delegated team occupy one office floor. Other main conversations have their own floors. Researchers, coders, reviewers, and other delegated sessions remain on their parent floor, including nested delegations.

V1 helps the user understand activity, delegation, collaboration, progress, blockers, and human-input requests. Later versions can add management actions; V1 is observation through the office.

## Visual contract

Use the approved **Botanical Studio** art direction and chunky 3D voxel characters: geometric bodies, squared heads, stepped hair/plants, sage and eucalyptus accents, natural wood, pale stone, greenery, teal/green seating, soft lighting. Avoid smooth clay, photorealism, and flat pixel-art treatment.

Reference `assets/botanical-studio-light-dark.png` for style and theme atmosphere and `assets/expanded-office-layout.png` for the expanded room program and approved lower three-quarter orthographic camera. Paths are relative to this prompt's directory. The images are concept references; build real 3D assets and geometry for the actual interactive scene.

Provide spacious human-manager/assistant, HR, and research areas, a large team room with collaborative desk islands and spare workstations, a creative space with a whiteboard/meeting table, and a pantry/lounge with coffee facilities and sofa. Keep clear doorways, walkable routes, consistent scale, and cutaway walls for readability. The human/assistant office distinction supersedes the older MANAGER signage in concept images.

Use one reusable floor scene with light and dark lighting/material presets following the app's existing theme toggle. Keep the dark scene readable. Theme switching preserves state, camera, selection, and character identity.

## Character model

Seven permanent role identities: executive assistant/coordinator, researcher, coder, reviewer, functional reviewer, HR, and scrum master. The assistant represents the root session. The remaining permanent leads represent department summaries, not invented backend sessions.

Each delegated session gets one temporary worker. Support up to ten temporary workers per floor, plus the seven role identities and human manager: at most 18 detailed characters on the selected floor. This is a display capacity, not a Bridge execution limit. Retain excess sessions in accessible summaries if encountered; do not silently omit work or expand capacity without a later scope change.

Use role definitions in `.github/agents/` accurately. HR builds AI capabilities, skills, tools, and roles. Scrum master coaches team health. Functional reviewer exercises real app workflows and collects evidence.

## Behavior

Use actual session and delegation signals. Routine handoffs use quick task/message animation; supported collaboration can bring characters to desks or meeting spaces. New temporary workers enter through a door and walk to a workstation. Truly idle leads can read, stretch, take coffee, or rest in the pantry. Completed temporary workers report and depart, while their results remain inspectable.

Healthy working, pending, waiting for AI, blocked, human input, completed, and health issues must be distinguishable. Blocked or waiting workers must not look like carefree idle agents. Keep failed delegation separate from session state. A delivered delegation result does not necessarily mean success or completion.

Actual statuses update immediately; movement never gates truth. Initial snapshots do not replay historical events, repeated snapshots do not duplicate arrivals/handoffs, and switching floors does not replay a backlog. Respect reduced motion and keep information available through text and icons.

## Interaction

- Office / Graph toggle, Office default; retain the existing graph.
- One detailed floor at a time; floor selector with task title, activity, and attention summaries.
- Notices wait for user click. Clicking opens the correct floor and details; never automatically move the user to an alert.
- Agent click opens a side panel. Temporary worker: associated session, task, status, delegator(s), progress, questions/needs, result/evidence, and existing-session link. Permanent department lead: workload summary and its sessions. Assistant: root session.
- V1 camera keeps the approved angle. Support pan, zoom, room-label focus, and Home reset.
- Desktop/laptop first; compact screens prioritize accessible summaries/details.
- No new in-office task creation, messaging, approvals, or drag-and-drop delegation. Existing application features remain accessible through their current views.

## Architecture and integration

Reuse the current React application, snapshot polling, theme signal, session navigation, and Overview/Logs composition. The snapshot is authoritative. Do not write backend session files from presentation logic.

Separate pure floor/session derivation, stable character/seat assignment, selection state, real 3D scene, animation coordination, camera policy, and accessible HTML controls. Reuse geometry/materials across floors and render only the selected floor in detail.

Derive floor grouping from real coordinator sessions and delegation relationships. Protect against cycles, unknown roles, missing records, shared sessions, and unregistered discoveries. Keep unresolved sessions accessible in an ungrouped list and existing graph/session views. Never invent relationships from names or timestamps. Validate the grouping rules against actual repository data before relying on them.

Prepare the scene and camera boundary for future orbit controls, camera-facing labels, and wall visibility handling. Implement only the agreed fixed-angle controls in V1. Choose compatible renderer dependencies during implementation planning after checking current repository and official dependency documentation.

## Acceptance

Verify root/descendant grouping, shared/missing/unknown sessions, worker capacity, lifecycle identity, duplicate-event suppression, accurate state presentation, attention navigation, theme/floor switching, and reconnect behavior. Exercise empty, one-worker, ten-worker, multiple-floor, and overflow fixtures; clearly identify fixture data as demo data. Check both themes, laptop layouts, keyboard access, reduced motion, and fallback when 3D is unavailable. Run the existing web build and meaningful targeted tests. Profile the selected-floor maximum and report measured performance and environment rather than claiming untested capacity.

The human approved the written design, including its technical defaults, for planning on 2026-10-17. Use the resulting plan at `../plans/2026-10-17-agent-office.md` and obtain the pending plan review/execution choice before implementation; preserve any later approvals instead of repeating completed review stages. Report any material data-model limitation and the smallest proposed remedy. When implementation is authorized, finish with working code, observed browser evidence, relevant test/build results, and any remaining limitations.
