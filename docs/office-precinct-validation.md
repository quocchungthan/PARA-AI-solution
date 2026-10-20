# Nine-Nine Precinct validation

Validated against the approved v2 miniature study and the user's overview, lounge and kitchenette references. The production scene keeps the projecting lounge, separate kitchenette, staggered bullpen and captain's wing. Rear-room proportions and door placement remain the approved approximation rather than surveyed set dimensions.

## Presentation and source behavior

- Two locally remembered styles; separate cameras; independent light/dark theme.
- Eight permanent cast representatives and at most ten temporary workers. Source names, status, selection and handoff IDs remain authoritative.
- Native antialiased rendering with DPR 1.5–2; higher prop detail is geometric, with small procedural screen/badge/flag textures.
- Optional visits have 20–40 second cooldowns and 3–5 second pauses. Work, selection, connectivity and reduced motion take priority.
- Roster and details survive asynchronous loading, failed chunks, graphics recovery and denied storage.
- Phone controls occupy a separate area above the drawing buffer. Desktop room labels update on the first camera frame.

## Resource evidence

The twenty-round-trip fixture keeps a single canvas connected, ten workers, selected details, independent room focus and one observed source report. Visits 2 and 20 both measured **16 geometries and 5 textures**, with no growth. The sample includes eight permanent representatives, theme changes and source-event identity checks. The test releases shadow render targets when replacing a scene, rather than waiting for an idle disposal callback.

## Software-renderer sample

Each sample runs for 30 seconds with the maximum visible population and a real fixture report. These measurements use Chromium's **ANGLE Vulkan SwiftShader** CPU renderer. They characterize this test environment; they do not establish GPU frame-rate performance.

| Style | Viewport | Completed renders/s | p95 browser frame interval | Draw calls | Geometries | Textures | Extra reduced-motion renders over 700 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Botanical | 1440×900 | 6.42 | 266.6 ms | 21 | 1 | 3 | 1 |
| Botanical | 390×844 | 12.83 | 100.0 ms | 21 | 1 | 3 | 1 |
| Precinct | 1440×900 | 5.48 | 333.3 ms | 35 | 16 | 6 | 1 |
| Precinct | 390×844 | 7.75 | 249.9 ms | 35 | 16 | 6 | 0 |

The steady switching sample uses 5 precinct textures. Interaction samples render a handoff card with a physically based material; Three.js then initializes its shared DFG lookup texture. This accounts for the additional texture compared with the reduced-motion switching fixture. Raw results include browser version, renderer string, drawing-buffer size, actual renderer DPR and completed-render counts in `web/test-results/office-evidence/performance-*.json`.

## Hardware sample

All four Edge samples passed using **Edge 155.0.4283.62**, Windows, and **Intel Arc Graphics through ANGLE D3D11**. Each uses the same headless browser settings, DPR 1 (renderer DPR 1.5), maximum population of 18 characters, and a 30-second interaction window. These are local development-server measurements of the implemented scene, not a promise for other GPUs, devices or production environments.

| Style | Viewport | Completed renders/s | p95 browser frame interval | Draw calls | Geometries | Textures | Extra reduced-motion renders over 700 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Botanical | 1440×900 | 115.93 | 8.5 ms | 21 | 1 | 3 | 2 |
| Botanical | 390×844 | 118.88 | 8.5 ms | 21 | 1 | 3 | 2 |
| Precinct | 1440×900 | 111.21 | 16.6 ms | 35 | 16 | 6 | 2 |
| Precinct | 390×844 | 118.69 | 8.5 ms | 35 | 16 | 6 | 1 |

The short reduced-motion samples include fixture polling and state updates; they do not imply a persistent animation loop. Dedicated static-idle checks also pass. Frame intervals describe browser requestAnimationFrame callbacks; completed renders are counted separately after rendering. Native-density close-up verification independently checks DPR 2 and the actual drawing-buffer dimensions.

## Checks and evidence

- `npm --prefix web run test:office`: 49/49 passed, including actual-floor route sampling, all role/worker seats, furniture collisions, glass fronts, camera preference validation, exact source identity, runtime remapping and ambient interruption.
- `npm --prefix web run build`: TypeScript and Vite passed. The existing lazy WebGL bundle still exceeds Vite's advisory chunk size; precinct scenery remains a separate lazy module (about 23 kB minified).
- `npm run test:e2e:office` from `web/`: 46 passed, 2 production-only cases skipped. Covers roster overflow/reveal, source handoffs, keyboard/touch, camera memory, denied storage, scene/context recovery, optional motion, cast, both themes and viewport sizes, native DPR 2, and resource stability.
- After the broad run, small precinct-only collision-footprint and glass-sill corrections were verified with the full 48 unit tests, build, and seven targeted precinct/style/resource browser cases, all passing. The broad suite was not repeated after those corrections.
- `OFFICE_GPU_PROFILE=1 npx playwright test tests/e2e/office-performance.spec.ts`: 4/4 passed; the hardware sample above is from these runs. The broad run supplied the four SwiftShader samples.

Screenshots and raw measurements are preserved locally in ignored `web/test-results/office-evidence/`. Key files include `precinct-1440-light-overview.png`, `precinct-1440-light-reverse.png`, `precinct-1440-light-plan.png`, room close-ups, both theme/viewport matrices, `precinct-full-walls.png`, `precinct-retina-kitchen.png`, failure/selection evidence, `resource-switching.json`, and `performance-*-{software,gpu}.json`. They are local QA artifacts rather than repository assets.

## Practical limits

The phone overview fits the whole miniature, so use room focus and zoom to inspect small props. Full walls and shelves intentionally obscure some interior views; Cutaway walls is the default inspection mode. Scenery follows the approved reference study, including approximate rear rooms. GPU performance depends on browser, driver, display density and device; SwiftShader is much slower. There is no new production dependency, backend change, generated work event, sound, room editor or game mechanic.

Production-path verification also passed: `npm run build -- --base=/office-check/`, followed by `OFFICE_PRODUCTION=1 npx playwright test tests/e2e/office-production.spec.ts` (2/2). This verifies lazy WebGL and precinct modules below `/office-check/`, saved precinct restoration after reload, and recovery after an aborted precinct chunk. A normal-root build was restored afterward.


## Independent review

A fresh reviewer found missing collision footprints for filing cabinets and loose chairs. The correction shares loose-chair placement between rendering and navigation and adds a regression derived from rendered geometry for every seat-to-seat reporting route and all permanent-role rest trips. The test failed before the correction and passed afterward. Final verification: 49/49 office unit tests, normal-root build, and three affected browser checks passed (ambient interruption, twenty style round trips, overview and room cameras). The earlier broad browser, hardware and deployment-path measurements were not repeated after this navigation-only correction; scenery placement and detail remain the same.

One minor is deferred: Botanical's cached shadows can retain the preceding wall height after toggling Cutaway walls until another shadow revision, such as a theme change. The wall geometry updates correctly. The independent review identified no critical issues, and its important navigation finding is resolved.
