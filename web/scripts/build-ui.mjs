import { build, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outDir = resolve(rootDir, "dist-ui");

// Ensure web/dist/ui is never left inside the para-bridge build output
rmSync(resolve(rootDir, "dist/ui"), { recursive: true, force: true });
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

console.log("1/4 Building standalone browser UI bundle (para-ui.js, para-ui.umd.js, para-ui.css)...");
await build({
  root: rootDir,
  configFile: false,
  publicDir: false,
  logLevel: "warn",
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(rootDir, "src/ui/browser.ts"),
      name: "ParaUI",
      formats: ["es", "umd"],
      fileName: (format) => (format === "es" ? "para-ui.js" : "para-ui.umd.js"),
      cssFileName: "para-ui",
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) return "para-ui.css";
          return "[name][extname]";
        },
      },
    },
  },
});

console.log("2/4 Building React component library bundle (react.js)...");
await build({
  root: rootDir,
  configFile: false,
  publicDir: false,
  logLevel: "warn",
  plugins: [react({ babel: { plugins: [["module:@preact/signals-react-transform"]] } })],
  build: {
    outDir,
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(rootDir, "src/ui/index.ts"),
      formats: ["es"],
      fileName: () => "react.js",
      cssFileName: "para-ui",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

console.log("3/4 Generating TypeScript declarations (index.d.ts)...");
const dtsContent = `import type { CSSProperties, ReactNode, FC, ForwardRefExoticComponent, RefAttributes } from "react";

export type ParaTheme = "dark" | "light";
export type SparkShape = "line" | "streak" | "dot" | "star";

export interface VanillaSparkOptions {
  sparkColor?: string | string[];
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  extraScale?: number;
  lineWidth?: number;
  shape?: SparkShape;
  ring?: boolean;
  ringColor?: string;
  fadeOut?: boolean;
  rotate?: number;
  spread?: number;
  angleOffset?: number;
  selector?: string;
}

export interface VanillaBorderGlowOptions {
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  colors?: string[];
  fillOpacity?: number;
  active?: boolean;
  activeSpeed?: number;
  activeProximity?: number;
}

export interface VanillaShinyTextOptions {
  disabled?: boolean;
  speed?: number;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  glow?: "none" | "subtle" | "medium" | "strong" | number;
}

export interface VanillaLatticeOptions {
  grid?: 3 | 4 | 5;
  pattern?: "orbit" | "pulse" | "wave" | "spiral" | "corners" | "cross" | "diag" | "ripple" | "snake" | "sweep";
  shape?: "square" | "round";
  speed?: number;
  color?: string;
  glow?: boolean;
  cellSize?: number;
  gap?: number;
  fontSize?: number;
  label?: string;
}

export interface VanillaStatusOrbOptions {
  online?: boolean | null;
  state?: "online" | "offline" | "connecting";
  label?: string;
  hint?: string;
}

export interface ParaToastOptions {
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface ParaUIOptions {
  spark?: boolean | VanillaSparkOptions;
  observe?: boolean;
  theme?: ParaTheme;
}

export interface ParaUIController {
  refresh: (root?: ParentNode) => void;
  destroy: () => void;
  sparkAt: (clientX: number, clientY: number, overrides?: Partial<VanillaSparkOptions>) => void;
  highlight: typeof highlightElement;
  flash: typeof flashElement;
  ring: typeof ringElement;
  animateNumber: typeof animateNumber;
  toast: typeof showParaToast;
  getTheme: typeof getParaTheme;
  setTheme: typeof setParaTheme;
  toggleTheme: typeof toggleParaTheme;
}

export declare function getParaTheme(): ParaTheme;
export declare function setParaTheme(theme: ParaTheme): void;
export declare function toggleParaTheme(): ParaTheme;
export declare function highlightElement(el: HTMLElement | null, options?: { durationMs?: number; scroll?: boolean }): void;
export declare function flashElement(el: HTMLElement | null, durationMs?: number): void;
export declare function ringElement(el: HTMLElement | null, durationMs?: number): void;
export declare function animateNumber(el: HTMLElement | null, to?: number, duration?: number): () => void;
export declare function showParaToast(options: ParaToastOptions): () => void;
export declare function mountBorderGlow(el: HTMLElement, options?: VanillaBorderGlowOptions): () => void;
export declare function mountClickSpark(target?: HTMLElement | Document, options?: VanillaSparkOptions): {
  destroy: () => void;
  sparkAt: (x: number, y: number, overrides?: Partial<VanillaSparkOptions>) => void;
};
export declare function mountShinyText(el: HTMLElement, options?: VanillaShinyTextOptions): () => void;
export declare function mountLatticeLoader(el: HTMLElement, options?: VanillaLatticeOptions): () => void;
export declare function mountStatusOrb(el: HTMLElement, options?: VanillaStatusOrbOptions): () => void;
export declare function enhanceParaUI(root?: ParentNode): (() => void)[];
export declare function initParaUI(options?: ParaUIOptions): ParaUIController;

export interface GlowCardProps {
  children: ReactNode;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  active?: boolean;
  light?: boolean;
  colors?: string[];
}

export declare const Logo: FC<{ light?: boolean; imageSrc?: string }>;
export declare const BrandName: FC<{ light?: boolean; text?: string }>;
export declare function OfflineTitle(props?: { title?: string; highlightWords?: string[]; light?: boolean }): JSX.Element;
export declare function NotFoundTitle(props?: { text?: string; light?: boolean }): JSX.Element;
export declare function OfflineBackdrop(props?: { light?: boolean }): JSX.Element | null;
export declare const StatusOrb: FC<{ online: boolean | null; label?: string; hint?: string }>;
export declare function Splash(props?: { light?: boolean; skip?: boolean; title?: string; subtitle?: string }): JSX.Element | null;
export declare function Loader(props: VanillaLatticeOptions & { className?: string; style?: CSSProperties }): JSX.Element;
export declare function GlowCard(props: GlowCardProps): JSX.Element;
export declare function PageSpark(props: { children: ReactNode; light?: boolean; selector?: string; sparkColor?: string | string[] }): JSX.Element;
export declare function AnimatedNumber(props: { value: number; duration?: number }): JSX.Element;

export declare const BorderGlow: FC<VanillaBorderGlowOptions & { children?: ReactNode; className?: string; style?: CSSProperties; animated?: boolean }>;
export declare const ClickSpark: ForwardRefExoticComponent<VanillaSparkOptions & { children?: ReactNode; className?: string; style?: CSSProperties; layerZIndex?: number } & RefAttributes<{ spark: (x?: number, y?: number) => void }>>;
export declare const ShinyText: FC<VanillaShinyTextOptions & { text?: string; children?: ReactNode; className?: string; style?: CSSProperties }>;
export declare const LatticeLoader: FC<VanillaLatticeOptions & { className?: string; style?: CSSProperties }>;
export declare const MetallicPaint: FC<Record<string, unknown>>;
export declare const MagicRings: FC<Record<string, unknown>>;
export declare const Strands: FC<Record<string, unknown>>;
export declare const LetterGlitch: FC<Record<string, unknown>>;
export declare const FuzzyText: FC<Record<string, unknown>>;
export declare const FallingText: FC<Record<string, unknown>>;
`;

writeFileSync(resolve(outDir, "index.d.ts"), dtsContent);

console.log("4/4 Cooking Seafile Custom CSS (seafile-custom.css & seafile-custom.min.css)...");
const seafileCssPath = resolve(rootDir, "src/ui/seafile-custom.css");
const seafileCssRaw = readFileSync(seafileCssPath, "utf8");
const seafileCompiled = await transformWithEsbuild(seafileCssRaw, seafileCssPath, {
  loader: "css",
  minify: true,
});
const seafileCssMin =
  "/* PARA UI Seafile Custom CSS (Seahub v11/v12/v13) */\n" +
  seafileCompiled.code.trim() +
  "\n";

writeFileSync(resolve(outDir, "seafile-custom.css"), seafileCssRaw);
writeFileSync(resolve(outDir, "seafile-custom.min.css"), seafileCssMin);

console.log("✓ Built PARA UI package & Seafile Custom CSS in dist-ui/ (para-ui.css, para-ui.js, para-ui.umd.js, react.js, index.d.ts, seafile-custom.css, seafile-custom.min.css)");
