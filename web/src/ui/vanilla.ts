export type ParaTheme = "dark" | "light";
export type SparkShape = "line" | "streak" | "dot" | "star";

export interface VanillaSparkOptions {
  sparkColor?: string | string[];
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  sparkWidth?: number;
  duration?: number;
  shape?: SparkShape;
  randomness?: number;
  gravity?: number;
  spread?: number;
  direction?: number;
  glow?: number;
  ring?: boolean;
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
}

export interface VanillaShinyTextOptions {
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  angle?: number;
  shineWidth?: number;
  softness?: number;
  direction?: "left" | "right";
  trigger?: "loop" | "hover" | "view";
}

export interface VanillaLatticeOptions {
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  status?: "working" | "done" | "error";
  pattern?: "arrow" | "dots" | "orbit" | "ripple" | "snake" | "spiral" | "sweep" | "spin" | "rain" | "pulse";
  grid?: 3 | 4;
  shape?: "square" | "round";
  color?: string;
  cellSize?: number;
  gap?: number;
  fontSize?: number;
  glow?: boolean;
  showTimer?: boolean;
}

export interface VanillaStatusOrbOptions {
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
  root?: ParentNode;
  sparks?: boolean | VanillaSparkOptions;
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const isReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function getParaTheme(): ParaTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setParaTheme(theme: ParaTheme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bridge-theme", theme);
      localStorage.setItem("para-theme", theme);
    }
  } catch {
    /* ignore */
  }
}

export function toggleParaTheme(): ParaTheme {
  const next: ParaTheme = getParaTheme() === "dark" ? "light" : "dark";
  setParaTheme(next);
  return next;
}

/* ---------- Action Helpers: Highlight, Flash, Ring, Number, Toast ---------- */

const highlightTimers = new WeakMap<HTMLElement, number>();

export function highlightElement(
  el: HTMLElement | null,
  options: { durationMs?: number; scroll?: boolean } = {},
): void {
  if (!el) return;
  const { durationMs = 3600, scroll = true } = options;
  const prev = highlightTimers.get(el);
  if (prev) window.clearTimeout(prev);

  el.classList.remove("para-highlight", "highlight");
  void el.offsetWidth; // force reflow so repeated triggers replay the animation
  el.classList.add("para-highlight", "highlight");

  if (scroll) {
    el.scrollIntoView({ behavior: isReducedMotion() ? "auto" : "smooth", block: "center" });
  }

  const timer = window.setTimeout(() => {
    el.classList.remove("para-highlight", "highlight");
    highlightTimers.delete(el);
  }, durationMs);
  highlightTimers.set(el, timer);
}

const flashTimers = new WeakMap<HTMLElement, number>();

export function flashElement(el: HTMLElement | null, durationMs = 1600): void {
  if (!el) return;
  const prev = flashTimers.get(el);
  if (prev) window.clearTimeout(prev);

  el.classList.remove("para-flash", "flash");
  void el.offsetWidth;
  el.classList.add("para-flash", "flash");

  const timer = window.setTimeout(() => {
    el.classList.remove("para-flash", "flash");
    flashTimers.delete(el);
  }, durationMs);
  flashTimers.set(el, timer);
}

const ringTimers = new WeakMap<HTMLElement, number>();

export function ringElement(el: HTMLElement | null, durationMs = 1800): void {
  if (!el) return;
  const prev = ringTimers.get(el);
  if (prev) window.clearTimeout(prev);

  el.classList.remove("para-ring", "ring");
  void el.offsetWidth;
  el.classList.add("para-ring", "ring");

  const timer = window.setTimeout(() => {
    el.classList.remove("para-ring", "ring");
    ringTimers.delete(el);
  }, durationMs);
  ringTimers.set(el, timer);
}

const numberValues = new WeakMap<HTMLElement, number>();
const numberRafs = new WeakMap<HTMLElement, number>();

export function animateNumber(el: HTMLElement | null, to?: number, duration = 600): () => void {
  if (!el) return () => {};
  const rawAttr = el.getAttribute("data-para-number");
  const target =
    typeof to === "number"
      ? to
      : rawAttr !== null && rawAttr !== ""
        ? Number(rawAttr)
        : Number((el.textContent ?? "0").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(target)) return () => {};

  const suffix = el.getAttribute("data-suffix") ?? "";
  const prefix = el.getAttribute("data-prefix") ?? "";
  const prevRaf = numberRafs.get(el);
  if (prevRaf) cancelAnimationFrame(prevRaf);

  const from = numberValues.get(el) ?? (Number((el.textContent ?? "0").replace(/[^0-9.-]/g, "")) || 0);
  if (isReducedMotion() || from === target) {
    numberValues.set(el, target);
    el.textContent = `${prefix}${Math.round(target)}${suffix}`;
    return () => {};
  }

  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    const current = Math.round(from + (target - from) * easeOutCubic(p));
    numberValues.set(el, current);
    el.textContent = `${prefix}${current}${suffix}`;
    if (p < 1) {
      numberRafs.set(el, requestAnimationFrame(tick));
    } else {
      numberValues.set(el, target);
      numberRafs.delete(el);
    }
  };
  const raf = requestAnimationFrame(tick);
  numberRafs.set(el, raf);
  return () => cancelAnimationFrame(raf);
}

let activeToastEl: HTMLElement | null = null;

export function showParaToast(options: ParaToastOptions): () => void {
  if (typeof document === "undefined") return () => {};
  if (activeToastEl) {
    activeToastEl.remove();
    activeToastEl = null;
  }

  const { title, subtitle, actionText = "View", onAction, durationMs = 6000 } = options;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");

  const body = document.createElement("button");
  body.type = "button";
  body.className = "toastBody";

  const icon = document.createElement("span");
  icon.className = "toastIcon para-ring";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z"/></svg>';

  const textWrap = document.createElement("span");
  const titleEl = document.createElement("b");
  titleEl.textContent = title;
  textWrap.appendChild(titleEl);
  if (subtitle) {
    const subEl = document.createElement("small");
    subEl.textContent = subtitle;
    textWrap.appendChild(subEl);
  }

  body.appendChild(icon);
  body.appendChild(textWrap);

  if (actionText) {
    const go = document.createElement("span");
    go.className = "toastGo";
    go.textContent = actionText;
    body.appendChild(go);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toastClose";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.textContent = "✕";

  const dismiss = () => {
    toast.remove();
    if (activeToastEl === toast) activeToastEl = null;
  };

  body.addEventListener("click", () => {
    onAction?.();
    dismiss();
  });
  closeBtn.addEventListener("click", dismiss);

  toast.appendChild(body);
  toast.appendChild(closeBtn);
  document.body.appendChild(toast);
  activeToastEl = toast;

  const timer = durationMs > 0 ? window.setTimeout(dismiss, durationMs) : 0;
  return () => {
    if (timer) window.clearTimeout(timer);
    dismiss();
  };
}

/* ---------- BorderGlow Enhancer ---------- */

const DEFAULT_GLOW_COLORS = ["#c084fc", "#f472b6", "#38bdf8"];
const GRADIENT_POSITIONS = ["80% 55%", "69% 34%", "8% 6%", "41% 38%", "86% 85%", "82% 18%", "51% 4%"];
const GRADIENT_KEYS = [
  "--gradient-one",
  "--gradient-two",
  "--gradient-three",
  "--gradient-four",
  "--gradient-five",
  "--gradient-six",
  "--gradient-seven",
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function parseHSL(hslStr: string): { h: number; s: number; l: number } {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 270, s: 95, l: 75 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function applyBorderGlowTheme(el: HTMLElement, opts: VanillaBorderGlowOptions) {
  const light = getParaTheme() === "light";
  const bg =
    opts.backgroundColor ??
    el.getAttribute("data-glow-bg") ??
    (light ? "#FFFFFF" : "#16171B");
  const glowHsl =
    opts.glowColor ??
    el.getAttribute("data-glow-hsl") ??
    (light ? "270 75 60" : "270 95 75");
  const intensity = opts.glowIntensity ?? (light ? 0.9 : 1.0);
  const radius = opts.borderRadius ?? Number(el.getAttribute("data-glow-radius") ?? 16);
  const glowPad = opts.glowRadius ?? Number(el.getAttribute("data-glow-spread") ?? 28);
  const edgeSens = opts.edgeSensitivity ?? 25;
  const coneSpread = opts.coneSpread ?? 22;
  const fillOpacity = opts.fillOpacity ?? 0.35;
  const colorsAttr = el.getAttribute("data-glow-colors");
  const colors = opts.colors ?? (colorsAttr ? colorsAttr.split(",").map((s) => s.trim()) : DEFAULT_GLOW_COLORS);

  el.classList.toggle("border-glow-card--light", light);
  el.style.setProperty("--card-bg", bg);
  el.style.setProperty("--edge-sensitivity", String(edgeSens));
  el.style.setProperty("--border-radius", `${radius}px`);
  el.style.setProperty("--glow-padding", `${glowPad}px`);
  el.style.setProperty("--cone-spread", String(coneSpread));
  el.style.setProperty("--fill-opacity", String(fillOpacity));

  const { h, s, l } = parseHSL(glowHsl);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
  for (let i = 0; i < opacities.length; i++) {
    el.style.setProperty(`--glow-color${keys[i]}`, `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`);
  }
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    el.style.setProperty(GRADIENT_KEYS[i], `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`);
  }
  el.style.setProperty("--gradient-base", `linear-gradient(${colors[0]} 0 100%)`);
}

const enhancedGlowElements = new WeakMap<HTMLElement, () => void>();

export function mountBorderGlow(el: HTMLElement, options: VanillaBorderGlowOptions = {}): () => void {
  const existing = enhancedGlowElements.get(el);
  if (existing) return existing;

  el.classList.add("border-glow-card", "glowCard");
  if (!el.querySelector(":scope > .edge-light")) {
    const inner = document.createElement("div");
    inner.className = "border-glow-inner";
    while (el.firstChild) {
      inner.appendChild(el.firstChild);
    }
    const edgeLight = document.createElement("span");
    edgeLight.className = "edge-light";
    edgeLight.setAttribute("aria-hidden", "true");
    el.appendChild(edgeLight);
    el.appendChild(inner);
  }

  applyBorderGlowTheme(el, options);

  const onPointerMove = (e: PointerEvent) => {
    if (el.classList.contains("glow-active")) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
    const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
    const edge = clamp(1 / Math.min(kx, ky), 0, 1);
    let degrees = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (degrees < 0) degrees += 360;

    el.style.setProperty("--edge-proximity", (edge * 100).toFixed(3));
    el.style.setProperty("--cursor-angle", `${degrees.toFixed(3)}deg`);
  };

  el.addEventListener("pointermove", onPointerMove);

  let raf = 0;
  const activeSpeed = options.activeSpeed ?? Number(el.getAttribute("data-glow-speed") ?? 4);
  const syncActive = () => {
    cancelAnimationFrame(raf);
    const isActive =
      options.active ||
      el.hasAttribute("data-para-glow-active") && el.getAttribute("data-para-glow-active") !== "false" ||
      el.classList.contains("glow-active");
    if (!isActive) {
      el.classList.remove("glow-active");
      el.style.setProperty("--edge-proximity", "0");
      return;
    }
    el.classList.add("glow-active");
    el.style.setProperty("--edge-proximity", "100");
    if (isReducedMotion()) {
      el.style.setProperty("--cursor-angle", "45deg");
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      el.style.setProperty("--cursor-angle", `${(((now - t0) / 1000) * (360 / activeSpeed)) % 360}deg`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  syncActive();

  const attrObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === "data-para-glow-active") syncActive();
      else if (m.attributeName?.startsWith("data-glow-")) applyBorderGlowTheme(el, options);
    }
  });
  attrObserver.observe(el, { attributes: true });

  const cleanup = () => {
    cancelAnimationFrame(raf);
    attrObserver.disconnect();
    el.removeEventListener("pointermove", onPointerMove);
    enhancedGlowElements.delete(el);
  };
  enhancedGlowElements.set(el, cleanup);
  return cleanup;
}

/* ---------- ClickSpark Enhancer ---------- */

interface SparkParticle {
  angle: number;
  reach: number;
  scale: number;
  life: number;
  spin: number;
  color: string;
  clear: string;
  glow: number;
}

interface SparkBurst {
  x: number;
  y: number;
  start: number;
  sparks: SparkParticle[];
  size: number;
  radius: number;
  width: number;
  duration: number;
  shape: SparkShape;
  gravity: number;
  ring: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ratio: number;
  left: number;
  top: number;
}

function parseRgbChannels(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.fillStyle = color;
  const normal = String(ctx.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(normal);
  if (hex) {
    const v = parseInt(hex[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(normal);
  if (rgb) {
    const parts = rgb[1].split(",").slice(0, 3).map((p) => parseFloat(p));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return [127, 183, 232];
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  const pinch = radius * 0.16;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(rotation) * radius, y + Math.sin(rotation) * radius);
  for (let i = 1; i <= 4; i++) {
    const a = rotation + (i * Math.PI) / 2;
    const mid = a - Math.PI / 4;
    ctx.quadraticCurveTo(
      x + Math.cos(mid) * pinch,
      y + Math.sin(mid) * pinch,
      x + Math.cos(a) * radius,
      y + Math.sin(a) * radius,
    );
  }
  ctx.closePath();
}

export function mountClickSpark(
  target: HTMLElement | Document = document,
  options: VanillaSparkOptions = {},
): { destroy: () => void; sparkAt: (x: number, y: number, overrides?: Partial<VanillaSparkOptions>) => void } {
  const isDoc = target === document || target === document.body || target === document.documentElement;
  const hostEl = isDoc ? document.body : (target as HTMLElement);
  const layer = document.createElement("div");
  layer.className = "para-spark-layer";
  layer.setAttribute("aria-hidden", "true");
  if (!isDoc) {
    if (getComputedStyle(hostEl).position === "static") hostEl.style.position = "relative";
    layer.style.position = "absolute";
  }
  hostEl.appendChild(layer);

  const bursts: SparkBurst[] = [];
  let raf = 0;
  let lastPress = { time: -1e9, x: 0, y: 0 };

  const removeBurst = (b: SparkBurst) => {
    b.canvas.remove();
    const idx = bursts.indexOf(b);
    if (idx >= 0) bursts.splice(idx, 1);
  };

  const frame = (now: number) => {
    raf = 0;
    const reduced = isReducedMotion();
    for (const burst of [...bursts]) {
      const elapsed = now - burst.start;
      const ctx = burst.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, burst.canvas.width, burst.canvas.height);
      ctx.setTransform(burst.ratio, 0, 0, burst.ratio, -burst.left * burst.ratio, -burst.top * burst.ratio);

      let alive = false;
      if (burst.ring) {
        const rLife = reduced ? 320 : burst.duration * 0.8;
        const rp = elapsed / rLife;
        if (rp < 1) {
          alive = true;
          const rad = 2 + burst.radius * 0.6 * (reduced ? 0.6 : easeOutCubic(rp));
          ctx.globalAlpha = Math.pow(1 - rp, 2) * 0.7;
          ctx.strokeStyle = burst.sparks[0]?.color ?? "#7FB7E8";
          ctx.lineWidth = Math.max(0.5, burst.width * (1 - rp) * 0.9);
          ctx.beginPath();
          ctx.arc(burst.x, burst.y, rad, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      for (const spark of burst.sparks) {
        const life = reduced ? 320 : burst.duration * spark.life;
        const p = elapsed / life;
        if (p >= 1) continue;
        alive = true;
        const e = reduced ? 0.55 : easeOutCubic(clamp(p, 0, 1));
        const seconds = reduced ? 0 : elapsed / 1000;
        const drop = 0.5 * burst.gravity * 500 * seconds * seconds;
        const dist = burst.radius * spark.reach * e;
        const w = burst.width * spark.scale;
        const fade = reduced ? 1 - p : 1 - smoothstep(burst.shape === "line" ? 0.55 : 0.7, 1, p);
        if (fade <= 0) continue;

        ctx.strokeStyle = spark.color;
        ctx.fillStyle = spark.color;

        const x1 = burst.x + Math.cos(spark.angle) * dist;
        const y1 = burst.y + Math.sin(spark.angle) * dist + drop;

        if (burst.shape === "dot") {
          const rad = w * 1.35 * (1 - 0.5 * e);
          ctx.globalAlpha = fade;
          ctx.beginPath();
          ctx.arc(x1, y1, rad, 0, Math.PI * 2);
          ctx.fill();
        } else if (burst.shape === "star") {
          const twinkle = reduced ? 1 - p : Math.pow(Math.sin(Math.PI * clamp(p * 1.1, 0, 1)), 0.7);
          const rad = burst.size * 0.6 * spark.scale * twinkle;
          if (rad > 0.05) {
            ctx.globalAlpha = fade;
            drawStar(ctx, x1, y1, rad, spark.angle + spark.spin * p * Math.PI * 0.5);
            ctx.fill();
          }
        } else {
          const len = burst.size * spark.scale * (reduced ? 0.5 : Math.pow(1 - p, 1.6));
          const x2 = burst.x + Math.cos(spark.angle) * (dist + Math.max(0.01, len));
          const y2 = burst.y + Math.sin(spark.angle) * (dist + Math.max(0.01, len)) + drop;
          ctx.lineCap = "round";
          if (spark.glow > 0) {
            ctx.globalAlpha = fade * 0.16 * spark.glow;
            ctx.lineWidth = w * 4.5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          ctx.globalAlpha = fade;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!alive) removeBurst(burst);
    }
    if (bursts.length) raf = requestAnimationFrame(frame);
  };

  const sparkAt = (clientX: number, clientY: number, overrides: Partial<VanillaSparkOptions> = {}) => {
    const merged = { ...options, ...overrides };
    const light = getParaTheme() === "light";
    const defaultColors = light ? ["#2F7FC4", "#3F6487"] : ["#7FB7E8", "#F4F6F9"];
    const rawColors = merged.sparkColor
      ? Array.isArray(merged.sparkColor)
        ? merged.sparkColor
        : [merged.sparkColor]
      : defaultColors;
    const colors = rawColors.filter(Boolean);
    const size = merged.sparkSize ?? 10;
    const radius = merged.sparkRadius ?? 22;
    const count = clamp(Math.round(merged.sparkCount ?? 8), 1, 64);
    const width = merged.sparkWidth ?? 2;
    const duration = merged.duration ?? 420;
    const randomness = clamp(merged.randomness ?? 0.2, 0, 1);
    const gravity = Math.max(0, merged.gravity ?? 0);
    const spread = clamp(merged.spread ?? 360, 0, 360);
    const direction = merged.direction ?? 0;
    const glow = clamp(merged.glow ?? 0.2, 0, 1);
    const shape: SparkShape = merged.shape ?? "line";
    const ring = merged.ring ?? false;

    const offset = Math.floor(Math.random() * colors.length);
    const full = spread >= 359.5;
    const arc = (spread * Math.PI) / 180;
    const heading = ((direction - 90) * Math.PI) / 180;
    const step = full ? (Math.PI * 2) / count : count > 1 ? arc / (count - 1) : 0;

    const sparks: SparkParticle[] = Array.from({ length: count }, (_, i) => {
      const base = full ? heading + step * i : count > 1 ? heading - arc / 2 + step * i : heading;
      const jitter = (Math.random() - 0.5) * randomness;
      return {
        angle: base + jitter * (step || arc || 1) * 0.9,
        reach: 1 + (Math.random() - 0.5) * 0.7 * randomness,
        scale: 1 + (Math.random() - 0.5) * 0.8 * randomness,
        life: 1 + (Math.random() - 0.5) * 0.5 * randomness,
        spin: Math.random() - 0.5,
        color: colors[(i + offset) % colors.length],
        clear: "",
        glow: 0,
      };
    });

    const reach = radius * 1.4 + size * 1.4 + width * 6 + 8;
    const hostRect = isDoc ? { left: 0, top: 0 } : hostEl.getBoundingClientRect();
    const box = {
      left: Math.max(clientX - reach, 0),
      top: Math.max(clientY - reach, 0),
      right: Math.min(clientX + reach, window.innerWidth),
      bottom: Math.min(clientY + reach + 0.5 * gravity * 500, window.innerHeight),
    };
    if (box.right - box.left < 1 || box.bottom - box.top < 1) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((box.right - box.left) * ratio);
    canvas.height = Math.ceil((box.bottom - box.top) * ratio);
    Object.assign(canvas.style, {
      position: "absolute",
      left: `${box.left - hostRect.left}px`,
      top: `${box.top - hostRect.top}px`,
      width: `${box.right - box.left}px`,
      height: `${box.bottom - box.top}px`,
      display: "block",
      pointerEvents: "none",
    });
    canvas.setAttribute("aria-hidden", "true");
    layer.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    for (const s of sparks) {
      const [r, g, b] = parseRgbChannels(ctx, s.color);
      s.clear = `rgba(${r}, ${g}, ${b}, 0)`;
      s.glow = glow * (0.35 + 0.65 * ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
    }

    bursts.push({
      x: clientX,
      y: clientY,
      start: performance.now(),
      sparks,
      size,
      radius,
      width,
      duration,
      shape,
      gravity,
      ring,
      canvas,
      ctx,
      ratio,
      left: box.left,
      top: box.top,
    });
    while (bursts.length > 24) removeBurst(bursts[0]);
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const selector = options.selector ?? "button, a, [role='button'], [role='menuitem'], [data-para-spark]";
  const matchTarget = (ev: Event): HTMLElement | null => {
    if (!(ev.target instanceof Element)) return null;
    if (ev.target.closest("[data-para-no-spark]")) return null;
    return ev.target.closest(selector) as HTMLElement | null;
  };

  const overridesForElement = (el: HTMLElement): Partial<VanillaSparkOptions> => {
    const out: Partial<VanillaSparkOptions> = {};
    const colorAttr = el.getAttribute("data-spark-color");
    if (colorAttr) out.sparkColor = colorAttr.split(",").map((c) => c.trim());
    const shapeAttr = el.getAttribute("data-spark-shape") as SparkShape | null;
    if (shapeAttr) out.shape = shapeAttr;
    if (el.hasAttribute("data-spark-ring")) out.ring = true;
    return out;
  };

  const onPointerDown = (ev: Event) => {
    const e = ev as PointerEvent;
    const matched = matchTarget(e);
    if (!matched || e.pointerType !== "mouse" || e.button !== 0) return;
    lastPress = { time: performance.now(), x: e.clientX, y: e.clientY };
    sparkAt(e.clientX, e.clientY, overridesForElement(matched));
  };

  const onClick = (ev: Event) => {
    const e = ev as MouseEvent;
    const matched = matchTarget(e);
    if (!matched) return;
    if ("pointerType" in e && e.pointerType === "mouse") return;
    if (e.detail === 0) {
      const rect = matched.getBoundingClientRect();
      sparkAt(rect.left + rect.width / 2, rect.top + rect.height / 2, overridesForElement(matched));
      return;
    }
    const recent =
      performance.now() - lastPress.time < 700 &&
      Math.hypot(e.clientX - lastPress.x, e.clientY - lastPress.y) < 12;
    if (!recent) sparkAt(e.clientX, e.clientY, overridesForElement(matched));
  };

  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("click", onClick);

  return {
    sparkAt,
    destroy: () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("click", onClick);
      for (const b of [...bursts]) removeBurst(b);
      layer.remove();
    },
  };
}

/* ---------- ShinyText Enhancer ---------- */

const enhancedShinyElements = new WeakMap<HTMLElement, () => void>();

export function mountShinyText(el: HTMLElement, options: VanillaShinyTextOptions = {}): () => void {
  const existing = enhancedShinyElements.get(el);
  if (existing) return existing;

  el.classList.add("shiny-text");
  const speed = options.speed ?? Number(el.getAttribute("data-shiny-speed") ?? 2.4);
  const delay = options.delay ?? Number(el.getAttribute("data-shiny-delay") ?? 2.2);
  const angle = options.angle ?? Number(el.getAttribute("data-shiny-angle") ?? 120);
  const width = options.shineWidth ?? Number(el.getAttribute("data-shiny-width") ?? 38);

  let raf = 0;
  let timer = 0;
  let alive = true;

  const getColors = () => {
    const light = getParaTheme() === "light";
    const base = options.color ?? el.getAttribute("data-shiny-color") ?? (light ? "#3A4250" : "#A0A6B0");
    const shine = options.shineColor ?? el.getAttribute("data-shiny-shine") ?? (light ? "#2F7FC4" : "#FFFFFF");
    return { base, shine };
  };

  const paintAt = (pos: number | null) => {
    const { base, shine } = getColors();
    if (pos === null || isReducedMotion()) {
      el.style.backgroundImage = `linear-gradient(${base}, ${base})`;
      return;
    }
    const half = width / 2;
    const s0 = (pos - half).toFixed(1);
    const s1 = pos.toFixed(1);
    const s2 = (pos + half).toFixed(1);
    el.style.backgroundImage = `linear-gradient(${angle}deg, ${base} 0%, ${base} ${s0}%, ${shine} ${s1}%, ${base} ${s2}%, ${base} 100%)`;
  };

  const runCycle = () => {
    if (!alive) return;
    if (isReducedMotion()) {
      paintAt(null);
      return;
    }
    const start = performance.now();
    const duration = speed * 1000;
    const from = 100 + width;
    const to = -width;
    const step = (now: number) => {
      if (!alive) return;
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 0.5 - Math.cos(Math.PI * t) / 2;
      paintAt(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        paintAt(null);
        timer = window.setTimeout(runCycle, delay * 1000);
      }
    };
    raf = requestAnimationFrame(step);
  };

  paintAt(null);
  runCycle();

  const cleanup = () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    enhancedShinyElements.delete(el);
  };
  enhancedShinyElements.set(el, cleanup);
  return cleanup;
}

/* ---------- LatticeLoader Enhancer ---------- */

const LATTICE_PATTERNS: Record<string, { n: 3 | 4; cells: (number | null)[]; loop: number; scale: number }> = {
  orbit: { n: 3, cells: [0, 1, 2, 7, null, 3, 6, 5, 4], loop: 8, scale: 1.2 },
  ripple: { n: 3, cells: [2, 1, 2, 1, 0, 1, 2, 1, 2], loop: 4.8, scale: 1.5 },
  spiral: { n: 3, cells: [0, 1, 2, 7, 8, 3, 6, 5, 4], loop: 9, scale: 1.2 },
  dots: { n: 3, cells: [0, 1, 2, 0, 1, 2, 0, 1, 2], loop: 3, scale: 2.4 },
  sweep: { n: 4, cells: [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6], loop: 5, scale: 1 },
  pulse: { n: 4, cells: [2, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 2], loop: 2.4, scale: 2.5 },
};

const enhancedLoaders = new WeakSet<HTMLElement>();

export function mountLatticeLoader(el: HTMLElement, options: VanillaLatticeOptions = {}): () => void {
  if (enhancedLoaders.has(el)) return () => {};
  enhancedLoaders.add(el);

  const patKey = options.pattern ?? el.getAttribute("data-pattern") ?? "orbit";
  const pat = LATTICE_PATTERNS[patKey] ?? LATTICE_PATTERNS.orbit;
  const grid = options.grid ?? (Number(el.getAttribute("data-grid")) === 4 ? 4 : pat.n);
  const label = options.label ?? el.getAttribute("data-label") ?? (el.textContent?.trim() || "Working");
  const status = options.status ?? (el.getAttribute("data-status") as "working" | "done" | "error") ?? "working";
  const shape = options.shape ?? (el.getAttribute("data-shape") as "round" | "square") ?? "round";
  const color = options.color ?? el.getAttribute("data-color") ?? "var(--ice)";
  const cellSize = options.cellSize ?? Number(el.getAttribute("data-cell-size") ?? 6);
  const gap = options.gap ?? Number(el.getAttribute("data-gap") ?? 2);
  const fontSize = options.fontSize ?? Number(el.getAttribute("data-font-size") ?? 13);
  const d = 90 * pat.scale;
  const cycle = Math.round(pat.loop * d);

  el.classList.add("lattice-loader");
  el.setAttribute("role", "status");
  el.setAttribute("data-status", status);
  el.setAttribute("data-shape", shape);
  if (options.glow !== false) el.setAttribute("data-glow", "");

  el.style.setProperty("--ll-n", String(grid));
  el.style.setProperty("--ll-cell", `${cellSize}px`);
  el.style.setProperty("--ll-gap", `${gap}px`);
  el.style.setProperty("--ll-font", `${fontSize}px`);
  el.style.setProperty("--ll-color", color);
  el.style.setProperty("--ll-glow", color);
  el.style.setProperty("--ll-cycle", `${cycle}ms`);

  const cells = grid === 4 && pat.cells.length === 9 ? LATTICE_PATTERNS.sweep.cells : pat.cells;
  const cellsHtml = cells
    .map((u) =>
      u == null
        ? `<span class="lattice-loader__cell" data-hole=""></span>`
        : `<span class="lattice-loader__cell" style="animation-delay:${Math.round(u * d)}ms"></span>`,
    )
    .join("");

  el.innerHTML =
    `<span class="lattice-loader__grid" aria-hidden="true">` +
    `<span class="lattice-loader__layer lattice-loader__run">${cellsHtml}</span>` +
    `</span>` +
    (label
      ? `<span class="lattice-loader__label"><span class="lattice-loader__text" data-active="">${label}</span></span>`
      : "");

  return () => {
    enhancedLoaders.delete(el);
  };
}

/* ---------- StatusOrb Enhancer ---------- */

const STATUS_DEFAULTS = {
  online: { label: "Online", hint: "Service connected" },
  offline: { label: "Offline", hint: "Service is not running" },
  connecting: { label: "Connecting", hint: "Looking for service…" },
} as const;

const enhancedOrbs = new WeakSet<HTMLElement>();

export function mountStatusOrb(el: HTMLElement, options: VanillaStatusOrbOptions = {}): () => void {
  if (enhancedOrbs.has(el)) return () => {};
  enhancedOrbs.add(el);

  const render = () => {
    const rawState = options.state ?? (el.getAttribute("data-state") as "online" | "offline" | "connecting") ?? "online";
    const key = rawState in STATUS_DEFAULTS ? rawState : "online";
    const def = STATUS_DEFAULTS[key];
    const label = options.label ?? el.getAttribute("data-label") ?? def.label;
    const hint = options.hint ?? el.getAttribute("data-hint") ?? def.hint;

    el.classList.add("statusOrb");
    el.setAttribute("data-state", key);
    el.setAttribute("role", "status");
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `${label}: ${hint}`);
    el.innerHTML =
      `<i class="dot"></i>` +
      `<span class="statusHint" role="tooltip" aria-hidden="true"><i class="dot"></i><b>${label}</b> ${hint}</span>`;
  };

  render();
  const obs = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.attributeName === "data-state" || m.attributeName === "data-label" || m.attributeName === "data-hint")) {
      render();
    }
  });
  obs.observe(el, { attributes: true });

  return () => {
    obs.disconnect();
    enhancedOrbs.delete(el);
  };
}

/* ---------- Declarative DOM Enhancer & Auto-Init ---------- */

export function enhanceParaUI(root: ParentNode = document): (() => void)[] {
  const cleanups: (() => void)[] = [];

  root.querySelectorAll<HTMLElement>(".glowCard, .border-glow-card, [data-para-glow]").forEach((el) => {
    cleanups.push(mountBorderGlow(el));
  });

  root.querySelectorAll<HTMLElement>("[data-para-shiny], .para-shiny").forEach((el) => {
    cleanups.push(mountShinyText(el));
  });

  root.querySelectorAll<HTMLElement>("[data-para-loader]").forEach((el) => {
    cleanups.push(mountLatticeLoader(el));
  });

  root.querySelectorAll<HTMLElement>("[data-para-orb]").forEach((el) => {
    cleanups.push(mountStatusOrb(el));
  });

  root.querySelectorAll<HTMLElement>("[data-para-number]").forEach((el) => {
    cleanups.push(animateNumber(el));
  });

  return cleanups;
}

export function initParaUI(options: ParaUIOptions = {}): ParaUIController {
  if (typeof document === "undefined") {
    return {
      refresh: () => {},
      destroy: () => {},
      sparkAt: () => {},
      highlight: highlightElement,
      flash: flashElement,
      ring: ringElement,
      animateNumber,
      toast: showParaToast,
      getTheme: getParaTheme,
      setTheme: setParaTheme,
      toggleTheme: toggleParaTheme,
    };
  }

  if (options.theme) {
    setParaTheme(options.theme);
  } else if (!document.documentElement.dataset.theme) {
    setParaTheme(getParaTheme());
  }

  const root = options.root ?? document;
  const cleanups = enhanceParaUI(root);

  let sparkHandle: ReturnType<typeof mountClickSpark> | null = null;
  if (options.sparks !== false) {
    const sparkOpts = typeof options.sparks === "object" ? options.sparks : {};
    sparkHandle = mountClickSpark(root === document ? document : (root as HTMLElement), sparkOpts);
  }

  const onActionClick = (ev: Event) => {
    if (!(ev.target instanceof Element)) return;
    const trigger = ev.target.closest<HTMLElement>("[data-para-action]");
    if (!trigger) return;
    const action = trigger.getAttribute("data-para-action");
    const targetSel = trigger.getAttribute("data-para-target");
    const targetEl = targetSel ? document.querySelector<HTMLElement>(targetSel) : trigger;

    if (action === "highlight") highlightElement(targetEl);
    else if (action === "flash") flashElement(targetEl);
    else if (action === "ring") ringElement(targetEl);
    else if (action === "theme") toggleParaTheme();
    else if (action === "toast") {
      showParaToast({
        title: trigger.getAttribute("data-toast-title") ?? "New task in the work queue",
        subtitle: trigger.getAttribute("data-toast-subtitle") ?? "Click to jump to the highlighted item",
        actionText: trigger.getAttribute("data-toast-action") ?? "View",
        onAction: () => {
          if (targetEl && targetEl !== trigger) highlightElement(targetEl);
        },
      });
    }
  };
  root.addEventListener("click", onActionClick);

  const themeObserver = new MutationObserver(() => {
    root.querySelectorAll<HTMLElement>(".border-glow-card").forEach((el) => applyBorderGlowTheme(el, {}));
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  let domObserver: MutationObserver | null = null;
  if (options.observe !== false) {
    domObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.target instanceof HTMLElement && m.attributeName === "data-para-number") {
          animateNumber(m.target);
        }
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches(".glowCard, .border-glow-card, [data-para-glow]")) cleanups.push(mountBorderGlow(node));
            if (node.matches("[data-para-shiny], .para-shiny")) cleanups.push(mountShinyText(node));
            if (node.matches("[data-para-loader]")) cleanups.push(mountLatticeLoader(node));
            if (node.matches("[data-para-orb]")) cleanups.push(mountStatusOrb(node));
            if (node.matches("[data-para-number]")) cleanups.push(animateNumber(node));
            cleanups.push(...enhanceParaUI(node));
          }
        });
      }
    });
    const observeTarget = root === document ? document.body : (root as Node);
    if (observeTarget) {
      domObserver.observe(observeTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-para-number"],
      });
    }
  }

  return {
    refresh: (r: ParentNode = root) => {
      cleanups.push(...enhanceParaUI(r));
    },
    destroy: () => {
      sparkHandle?.destroy();
      themeObserver.disconnect();
      domObserver?.disconnect();
      root.removeEventListener("click", onActionClick);
      for (const fn of cleanups) fn();
    },
    sparkAt: (x, y, overrides) => sparkHandle?.sparkAt(x, y, overrides),
    highlight: highlightElement,
    flash: flashElement,
    ring: ringElement,
    animateNumber,
    toast: showParaToast,
    getTheme: getParaTheme,
    setTheme: setParaTheme,
    toggleTheme: toggleParaTheme,
  };
}
