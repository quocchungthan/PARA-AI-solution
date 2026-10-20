# `@quocchungthan/para-ui`

Reusable UI kit extracted from **PARA Bridge**: dark/light Graphite & Ice theme tokens, pointer-tracked **BorderGlow** cards, **ClickSpark** interactive feedback, **ShinyText** metallic headers, **LatticeLoader** matrix indicators, **StatusOrb** WebGL/CSS status badges, spotlight highlights, state flashes, toast notifications, and a paste-ready **Seafile Custom CSS** theme.

---

## Agent office dashboard

The dashboard's Overview opens **Office** by default. **Graph** keeps the existing orchestration network available. Botanical Studio is a procedural 3D voxel office with the same light/dark switch as the dashboard; it is dashboard code, separate from the published UI-kit entry points.

- One shared office shows activity across every session, grouped by agent role like the network graph. No conversation floor selection is needed; standalone sessions and sessions with missing/cyclic delegation records remain accessible.
- **You** are the visual manager. The executive assistant summarizes all coordinator sessions. Six other permanent department leads summarize research, implementation, code review, functional review, agent/tool capabilities (HR), and team health. They are representatives, not extra backend agent sessions.
- Every unfinished session, including coordinator sessions, can occupy a temporary worker seat. At most **10 temporary workers appear across the whole office**. All sessions, including overflow and completed results, remain in the roster. Selecting an overflow session reveals it without increasing the capacity. This display limit never limits Bridge execution.
- Additional/custom agent roles appear under their recorded names in role summaries and the roster, with generic workers rather than additional rooms. Source registration is independent of whether a role has a built-in visual mapping.
- Click an actor or use its roster button for a nonmodal observation panel. It shows source state, delegators, questions, needs, recent progress, results and handoffs. **Open session** opens the existing inspector/reply drawer. The office itself has no assignment or reply form.
- Human-input, health, and failed/limited handoff notices have separate meanings. They wait for your click and never move the camera automatically. Dismissing a notice hides its presentation; the underlying global counts and session details remain visible.
- Left-drag to orbit through 360°, right-drag or Shift-drag to pan, and scroll to zoom. On touch screens, use one finger to orbit and two fingers to pan/pinch. Vertical orbit stays upright above the target. Room labels/controls keep your angle; **Home** restores the default V view and fits the office. One shared camera is remembered during navigation.
- Office uses the full panel width with logs below; Graph retains its existing layout. Removing floor controls leaves more vertical room for the canvas.
- Buttons and the full roster work with a keyboard. Escape closes focused observation details and returns focus. Reduced motion suppresses walking and fidgeting while preserving status text. Under 900 CSS pixels, summaries load first; **Show 3D office** opts into a compact preview.
- When rendering/chunk loading fails, keep using summaries or **Graph**; **Retry 3D office** recreates the scene. Graphics context loss preserves selection and camera. Bridge outages use the existing offline screen, then restore surviving context without replaying the gap.

Snapshots are authoritative. Animations illustrate observed arrivals and actual delegation/report relationships; the two-second poll can miss intermediate events. Flying handoff/report cards require both exact session workers to be visible; an absent worker is never replaced by a role representative. Events and source details remain accessible when their endpoints are list-only. Waiting/blocked workers do not become idle lounge characters. Missing records, cycles and source warnings remain disclosed in observation details; relationships do not gate session visibility, and a shared target is counted only once.

Develop and verify with Node 24:

```sh
npm ci
npx playwright install chromium
npm run test:office
npm run test:e2e:office
npm run build
npm run build:ui
```

Browser tests intercept the local Bridge API with synthetic fixtures and reject writes. To smoke-test built assets below a deployment prefix, run `OFFICE_PRODUCTION=1 npm run test:e2e:office -- --grep 'production:'` (PowerShell: `$env:OFFICE_PRODUCTION='1'` first). The browser harness defaults to deterministic software graphics; `OFFICE_GPU_PROFILE=1` uses an installed Edge browser's normal graphics path for a local performance measurement. The verification-only `office-checks.yml` workflow never publishes or deploys.

Browser screenshots and frame timings are written to `test-results/office-evidence/`, which is ignored by Git and included in CI failure artifacts.

---

## 1. Install from GitHub Packages

Configure `@quocchungthan` to use GitHub Packages in your project's `.npmrc`:

```ini
@quocchungthan:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @quocchungthan/para-ui
```

### Package Exports

| Export Path | File | Description |
|---|---|---|
| `@quocchungthan/para-ui` | `dist-ui/react.js` (`index.d.ts`) | React components + vanilla helpers + TypeScript types |
| `@quocchungthan/para-ui/vanilla` | `dist-ui/para-ui.js` / `para-ui.umd.js` | Zero-dependency vanilla JS DOM enhancer (ESM & UMD) |
| `@quocchungthan/para-ui/style.css` | `dist-ui/para-ui.css` | Complete stylesheet (theme variables, animations, components) |
| `@quocchungthan/para-ui/seafile.css` | `dist-ui/seafile-custom.css` | Self-hosted Seafile Custom CSS (Seahub v11 / v12 / v13) |

---

## 2. Usage in React / Vite

Import the stylesheet once at your app entry point, then use the React components or imperative action helpers:

```tsx
import "@quocchungthan/para-ui/style.css";
import {
  PageSpark,
  GlowCard,
  StatusOrb,
  Loader,
  Splash,
  Logo,
  BrandName,
  AnimatedNumber,
  OfflineTitle,
  NotFoundTitle,
  OfflineBackdrop,
  // Imperative DOM action helpers
  highlightElement,
  flashElement,
  ringElement,
  showParaToast,
  setParaTheme,
  toggleParaTheme,
} from "@quocchungthan/para-ui";

export function DashboardCard() {
  return (
    <PageSpark>
      <header className="brand">
        <Logo />
        <BrandName text="MY APP" />
        <StatusOrb online={true} label="Online" hint="Connected to local service" />
      </header>

      <GlowCard id="job-card" active={false} radius={16}>
        <div className="task">
          <div className="taskTop">
            <span>#job-42</span>
            <Loader pattern="orbit" grid={3} label="Running" />
          </div>
          <h3 className="taskTitle">Index Knowledge Base</h3>
          <p className="taskNote">
            Processed <AnimatedNumber value={128} /> documents
          </p>
          <button
            className="actionBtn"
            onClick={() =>
              highlightElement(document.getElementById("job-card"))
            }
          >
            Spotlight Card
          </button>
        </div>
      </GlowCard>
    </PageSpark>
  );
}
```

### React Components Reference

- **`<PageSpark light? selector? sparkColor?>`**: Wraps your app so clicking any interactive element (`button, a, [role='button'], .task, .chip.filter, .chip.toggle, summary`) spawns a radial spark burst.
- **`<GlowCard active? radius? light? colors?>`**: Card with pointer-tracked conic border refraction (`BorderGlow`). Set `active={true}` for a continuous orbital sweep while a task is running.
- **`<StatusOrb online={true | false | null} label? hint?>`**: Animated status indicator with hover tooltip (`online` = green, `offline` = red, `null` = ice-blue connecting).
- **`<Loader pattern? grid? shape? speed? label?>`**: Matrix lattice loader (`orbit`, `ripple`, `sweep`, `pulse`, `wave`, `spiral`, `corners`, `cross`, `diag`, `snake`).
- **`<BrandName text? light?>`**: Metallic animated `ShinyText` heading.
- **`<AnimatedNumber value duration?>`**: Smooth cubic-out number tweening.
- **`<Splash title? subtitle? skip? light?>`**: Full-screen intro splash with `MagicRings` backdrop.

---

## 3. Usage in Vanilla HTML / Static Sites (No React Required)

Import `@quocchungthan/para-ui/style.css` and `@quocchungthan/para-ui/vanilla` (or load `para-ui.css` + `para-ui.umd.js` with `data-para-auto`):

```html
<link rel="stylesheet" href="/path/to/para-ui.css" />
<script src="/path/to/para-ui.umd.js" data-para-auto defer></script>
```

Or initialize in JS/TS:

```ts
import "@quocchungthan/para-ui/style.css";
import { initParaUI } from "@quocchungthan/para-ui/vanilla";

const ui = initParaUI({
  theme: "dark", // "dark" | "light"
  observe: true, // auto-enhances dynamically added DOM nodes
});
```

### Declarative `data-para-*` Attributes

Any element in the DOM is automatically enhanced when `initParaUI()` (or `data-para-auto`) is active:

| Attribute | Options | Effect |
|---|---|---|
| `data-para-glow` | `data-para-glow-active="true"`, `data-glow-radius="16"`, `data-glow-colors="#c084fc,#f472b6,#38bdf8"` | Wraps the element in a pointer-tracked **BorderGlow** card (or continuous orbital sweep when `data-para-glow-active="true"`). |
| `data-para-shiny` | `data-shiny-speed="3"`, `data-shiny-color`, `data-shiny-shine` | Applies the animated metallic **ShinyText** sweep. |
| `data-para-loader` | `data-pattern="orbit\|ripple\|sweep\|pulse"`, `data-grid="3\|4\|5"`, `data-label="..."` | Renders an animated **LatticeLoader** grid. |
| `data-para-orb` | `data-state="online\|offline\|connecting"`, `data-label="..."`, `data-hint="..."` | Renders a **StatusOrb** with hover tooltip. |
| `data-para-number="94"` | `data-prefix=""`, `data-suffix="%"` | Smoothly animates numbers whenever `data-para-number` changes. |
| `data-para-action` | `"highlight" \| "flash" \| "ring" \| "toast" \| "theme"` + `data-para-target="#selector"` | Wires click actions without writing JS handlers. |
| `data-spark-shape` | `"line" \| "streak" \| "dot" \| "star"`, `data-spark-color="#F5C563,#5DD6A0"`, `data-spark-ring` | Customizes the **ClickSpark** burst on a specific button/link. |

### Imperative JS API (`window.paraUI` or named imports)

```ts
import {
  highlightElement,
  flashElement,
  ringElement,
  animateNumber,
  showParaToast,
  setParaTheme,
  toggleParaTheme,
} from "@quocchungthan/para-ui/vanilla";

// 1. Ice-blue spotlight pulse + smooth scroll into view
highlightElement(document.querySelector("#row-1"), { durationMs: 3600, scroll: true });

// 2. 1.6s border flash when a card's data updates
flashElement(document.querySelector("#kpi-card"));

// 3. Bell shake animation
ringElement(document.querySelector("#bell-icon"));

// 4. Spawn a top-right notification toast
showParaToast({
  title: "New task in the work queue",
  subtitle: "Click to jump to the highlighted item",
  actionText: "View",
  onAction: () => highlightElement(document.querySelector("#row-1")),
});

// 5. Switch between "dark" and "light" themes
toggleParaTheme();
```

---

## Selectable 3D offices

The Office view offers **Botanical Studio** and **Nine-Nine Precinct** through the **Office style** selector. Botanical is the default. Your style and each office's camera are remembered locally; light/dark theme is independent. Switching preserves live sessions, selection, notices and source events, while moving workers to valid seats in the destination layout.

Use Home and room buttons to focus the scene, drag to orbit, right-drag or Shift-drag to pan, and scroll to zoom. Precinct also has Reverse and Plan views, a separate kitchenette, and a projecting break room. **Cutaway walls** opens the near partitions and captain's bookcase; turn it off to inspect their full detail. On narrow screens choose **Show 3D office** first. Roster and details remain usable while graphics load or recover.

Precinct representatives use the approved cast mapping while labels retain real PARA roles and session names. Optional coffee/rest visits yield to work, selection, connectivity and reduced motion. The global temporary-worker limit remains ten. See [precinct validation](../docs/office-precinct-validation.md) for measured evidence and the approximation used for the rear rooms.

## 4. Self-Hosted Seafile Custom CSS (`seafile-custom.css`)

Every pipeline run builds `seafile-custom.css` and `seafile-custom.min.css` and uploads them as the **`seafile-custom-css`** artifact on the GitHub Actions run (and prints a copy-paste block in the workflow summary).

- **Method A — Seafile System Admin Web UI**:
  1. In Seafile, open **System Admin → Settings** (or **Branding**).
  2. Enable **Custom CSS** (`ENABLE_BRANDING_CSS`).
  3. Paste the contents of `seafile-custom.min.css` (from the Actions run summary or artifact) into the **Custom CSS** box and click **Save**.
- **Method B — `seahub_settings.py`**:
  1. Copy `seafile-custom.css` to `<seafile-data>/seahub-data/custom/custom.css`.
  2. Add `BRANDING_CSS = 'custom/custom.css'` to `conf/seahub_settings.py` and restart Seahub.
