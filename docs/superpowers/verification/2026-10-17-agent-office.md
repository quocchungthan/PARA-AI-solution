# Agent office verification

Date: 2026-10-17. Implementation and local verification complete; independent branch review is pending.

The scene is real procedural Three.js geometry, not a concept PNG. It interprets the approved Botanical Studio references with a fixed lower three-quarter orthographic camera, roomy rear offices, four team islands, research stations, creative table/board, pantry and sofa. The original graph and session/reply drawer are retained.

## Evidence and environment

Local Windows 11 build 26200, Intel Core Ultra 9 185H (16 cores / 22 logical processors), Node 24.16.0. Installed versions: React 19.3.1, Fiber 9.8.2, Three.js 0.186.1, Playwright 1.64.1. Test viewports include 1440×900, 1366×768 and 390×844. Browser fixtures intercept the existing Bridge API and reject writes; no real sessions are generated or modified.

The initial 30-second maximum-population sample used Chromium 156 with ANGLE SwiftShader, DPR 1, 18 characters, another floor requiring attention, pan/zoom and an observed handoff. It measured 8.42 fps / 118.76 ms mean / 216.60 ms p95, 149 draw calls, 43,464 triangles and 75 geometry allocations. This is a software-rendering baseline, not a hardware benchmark.

Measured optimizations share one geometry/material allocation, batch each articulated character into one draw call, cache static room/furniture shadows, and use cheaper matte Lambert shading. Characters retain all parts, identities, status and interaction. Moving characters receive room shadows but do not cast dynamic shadows; chair/furniture shadows retain grounding. The scene keeps all 18 characters at 21 steady draw calls and 23,532 triangles. Full Chromium could not launch in this environment (`spawn UNKNOWN`), so the local hardware run used installed Edge 155 with Intel Arc Direct3D11. That **30-second hardware run measured 59.79 fps, 16.73 ms mean and 16.90 ms p95**, exceeding the proposed 30 fps target on this documented machine. This is one observed desktop/browser result, not a guarantee for every device. The software-only matte-shading sample measured 13.73 fps.

## Verification record

- Baseline before implementation: `npm ci`, `npm run build`, `npm run build:ui` passed.
- Data/status/runtime/layout/motion/notice tests: 16 passing at the end of Task 7. New behavioral assertions were observed failing before their implementation.
- Final local commands: `npm run test:office` passed 16/16; `npm run test:e2e:office` passed 21/21 applicable tests in 4.6 minutes, with the production-only test skipped for its separate invocation; `npm run build` and `npm run build:ui` passed. A settled-canvas framing regression and explicit circulation graph export were added after observed failures; the affected camera/attention/reconnect/theme checks also passed 4/4.
- `$env:OFFICE_PRODUCTION='1'; npm run test:e2e:office -- --grep 'production:'` passed against the fresh build at `/office-check/`. The office renderer is a separate lazy chunk (~966 kB minified / 261 kB gzip); Vite emits its standard large-chunk warning. `dist-ui` JavaScript contains none of the office or Three.js renderer code.
- Geometry resource tests reproduced 75 allocations, then passed with shared resources. Per-frame draw checks reproduced 149 shadow-inclusive calls, then 75 limb draws, and passed after batching with fewer than 30 calls.
- A collapsed compact preview was found by screenshot inspection, reproduced with a minimum usable-height assertion, and fixed. Keyboard close/Escape restore focus; the existing drawer closes observation details. Renderer initialization, lazy fetch failure/retry and context-loss/retry retain textual observation and Logs.
- Only the existing store snapshot poller is used. The scene timer advances presentation deadlines and does not fetch API data. A recoverable outage longer than 10 seconds preserves surviving selection/camera and hydrates without replay.
- Existing publish/deploy workflow is unchanged; new office CI has read-only repository permissions and verification steps only.

## Visual artifacts

- [Maximum population, light](assets/agent-office/maximum-light.png) and [dark](assets/agent-office/maximum-dark.png).
- [Another-floor attention](assets/agent-office/other-floor-attention.png).
- [Compact preview](assets/agent-office/compact.png), [renderer retry](assets/agent-office/renderer-retry.png), [pantry idle](assets/agent-office/pantry-idle.png), [selected worker](assets/agent-office/selected-worker.png), [selected worker in dark mode](assets/agent-office/selected-worker-dark.png), and [rendering fallback](assets/agent-office/rendering-fallback.png).
- [Hardware performance](assets/agent-office/performance-hardware.json), [original software baseline](assets/agent-office/performance-software-baseline.json), [shared resources](assets/agent-office/performance-shared-resources.json), [batched actors](assets/agent-office/performance-batched.json), and [latest regression sample](assets/agent-office/performance.json).

Images are actual browser screenshots using synthetic test fixtures. They are evidence of the implementation, rather than live user work. Selected-worker, pantry and final fallback evidence are produced by the release scenario. No video recording is claimed.

## Practical limits

The snapshot has no explicit root/floor ID. Floors follow observed valid delegations from a registered coordinator; unresolved ancestry, cycles, unknown roles and unregistered records remain disclosed. Shared workers disclose multiple delegators. A `result_fed` handoff can report waiting/blocked work and never implies successful completion on its own. Polling can miss intermediate events; short animations are coalesced rather than treated as a complete event replay. Ten is a character display limit, with every session retained in the roster/history.

Hardware frame-rate acceptance is observed for the documented Edge/Intel Arc configuration. Independent review is pending. The new CI workflow is configured but has not run on GitHub in this local execution.
