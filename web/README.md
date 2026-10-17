# `@quocchungthan/para-ui`

Reusable UI kit extracted from **PARA Bridge**: dark/light Graphite & Ice theme tokens, pointer-tracked **BorderGlow** cards, **ClickSpark** interactive feedback, **ShinyText** metallic headers, **LatticeLoader** matrix indicators, **StatusOrb** WebGL/CSS status badges, spotlight highlights, state flashes, toast notifications, and a paste-ready **Seafile Custom CSS** theme.

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

## 4. Self-Hosted Seafile Custom CSS (`seafile-custom.css`)

Every pipeline run builds `seafile-custom.css` and `seafile-custom.min.css` and uploads them as the **`seafile-custom-css`** artifact on the GitHub Actions run (and prints a copy-paste block in the workflow summary).

- **Method A — Seafile System Admin Web UI**:
  1. In Seafile, open **System Admin → Settings** (or **Branding**).
  2. Enable **Custom CSS** (`ENABLE_BRANDING_CSS`).
  3. Paste the contents of `seafile-custom.min.css` (from the Actions run summary or artifact) into the **Custom CSS** box and click **Save**.
- **Method B — `seahub_settings.py`**:
  1. Copy `seafile-custom.css` to `<seafile-data>/seahub-data/custom/custom.css`.
  2. Add `BRANDING_CSS = 'custom/custom.css'` to `conf/seahub_settings.py` and restart Seahub.
