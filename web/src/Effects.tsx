import { Suspense, lazy, memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Hexagon } from "@phosphor-icons/react";
import { dark, skipSplash as notFound } from "./ui/theme";
import ShinyText from "./reactbits/ShinyText/ShinyText";
import MetallicPaint from "./reactbits/MetallicPaint/MetallicPaint";
import ClickSpark from "./reactbits/ClickSpark/ClickSpark";
import MagicRings from "./reactbits/MagicRings/MagicRings";
import LatticeLoader, { type LatticeLoaderProps } from "./reactbits/LatticeLoader/LatticeLoader";
import BorderGlow from "./reactbits/BorderGlow/BorderGlow";
import LetterGlitch from "./reactbits/LetterGlitch/LetterGlitch";
import Strands from "./reactbits/Strands/Strands";
import FuzzyText from "./reactbits/FuzzyText/FuzzyText";

// matter-js is only needed when the backend is unreachable, so load it on demand.
const FallingText = lazy(() => import("./reactbits/FallingText/FallingText"));

const HEXAGON = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 256 256'>" +
    "<path d='M128 20 L222 74 L222 182 L128 236 L34 182 L34 74 Z' fill='black' stroke='black' stroke-width='24' stroke-linejoin='round'/></svg>",
)}`;

const hasWebGL2 = (() => {
  try { return typeof document !== "undefined" && !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
})();

// Memoised so the 1s clock re-render of the header never reaches the WebGL canvas.
export const Logo = memo(function Logo({ light, imageSrc = HEXAGON }: { light?: boolean; imageSrc?: string }) {
  const isLight = light ?? !dark.value;
  if (!hasWebGL2) return <span className="logo fallback"><Hexagon weight="fill" /></span>;
  return (
    <span className="logo" aria-hidden>
      <MetallicPaint imageSrc={imageSrc} lightMode={isLight} color={isLight ? "#5B6370" : "#ffffff"}
        speed={0.35} scale={0.9} mouseTilt={0.6} dispersion={0.25} />
    </span>
  );
});

export const BrandName = memo(function BrandName({ light, text = "PARA" }: { light?: boolean; text?: string }) {
  const isLight = light ?? !dark.value;
  return (
    <ShinyText text={text} className="brandName" speed={2.4} delay={2.5}
      color={isLight ? "#3A4250" : "#A0A6B0"} shineColor={isLight ? "#7FB7E8" : "#FFFFFF"} />
  );
});

export function OfflineTitle({
  title = "Bridge service is not running",
  highlightWords = ["not", "running"],
  light,
}: {
  title?: string;
  highlightWords?: string[];
  light?: boolean;
} = {}) {
  const isLight = light ?? !dark.value;
  return (
    <Suspense fallback={<h2 className="offlineFall static">{title}</h2>}>
      <FallingText text={title} highlightWords={highlightWords}
        trigger="auto" restoreDelay={2.2} gravity={0.9} bounciness={0.35} fontSize="clamp(22px, 3.2vw, 32px)"
        accentColor={isLight ? "#C93848" : "#F07882"} theme={isLight ? "light" : "dark"} className="offlineFall" />
    </Suspense>
  );
}

/** "404" in React Bits Fuzzy Text, cool monochrome (slate white/gray/black) without RGB split; fuzz swells on hover. */
export function NotFoundTitle({ text = "404", light }: { text?: string; light?: boolean } = {}) {
  const isLight = light ?? !dark.value;
  return (
    <div className="notFoundCode">
      <FuzzyText fontSize="clamp(96px, 18vw, 180px)" fontWeight={900} color={isLight ? "#14181D" : "#F4F6F9"}
        gradient={isLight ? ["#0F172A", "#334155", "#64748B"] : ["#F8FAFC", "#CBD5E1", "#64748B"]} baseIntensity={0.16} hoverIntensity={0.45} fuzzRange={24}
        glitchMode glitchInterval={2600} glitchDuration={220} colorSplit={0}>{text}</FuzzyText>
    </div>
  );
}

/** Full-page Letter Glitch backdrop for the "bridge is not running" screen: gray glyphs with the offline red. */
export function OfflineBackdrop({ light }: { light?: boolean } = {}) {
  const isLight = light ?? !dark.value;
  if (!hasWebGL2) return null;
  return (
    <div className="offlineBg" aria-hidden>
      <LetterGlitch lightMode={isLight} backgroundColor={isLight ? "#F3F4F6" : "#09090B"}
        baseColor={isLight ? "#6B7280" : "#9CA3AF"}
        glitchColors={isLight ? ["#18181b", "#C93848"] : ["#F4F6F9", "#F07882"]}
        baseOpacity={isLight ? 0.12 : 0.14} glitchAmount={0.45} speed={0.8} edgeFade={0.15} />
    </div>
  );
}

// Strands colour roles: warm sheet (edge, mid, highlight, core) then cool sheet (accent, mid, deep).
const STATUS = {
  online: { label: "Online", hint: "Bridge connected", speed: 1.5, energy: 1,
    colors: ["#16A34A", "#22C55E", "#FACC15", "#ECFCCB", "#22D3EE", "#4ADE80", "#8B5CF6"] },
  offline: { label: "Offline", hint: "Bridge service is not running", speed: 1.1, energy: 0.8,
    colors: ["#DC2626", "#F43F5E", "#FB923C", "#FFE4E6", "#F472B6", "#EF4444", "#A855F7"] },
  connecting: { label: "Connecting", hint: "Looking for the Bridge…", speed: 1.2, energy: 0.7,
    colors: ["#3B82F6", "#60A5FA", "#A78BFA", "#F8FAFC", "#22D3EE", "#818CF8", "#6366F1"] },
} as const;

/** Header connection indicator: Strands in the status hue (green online / red offline) inside a themed orb, with a hover/focus hint. */
export const StatusOrb = memo(function StatusOrb({
  online,
  label,
  hint,
}: {
  online: boolean | null;
  label?: string;
  hint?: string;
}) {
  const key = online ? "online" : online === false ? "offline" : "connecting";
  const s = STATUS[key];
  const shownLabel = label ?? s.label;
  const shownHint = hint ?? s.hint;
  return (
    <span className="statusOrb" data-state={key} role="status" tabIndex={0} aria-label={`${shownLabel}: ${shownHint}`}>
      {hasWebGL2
        ? <span className="orbCore">
            <Strands colors={[...s.colors]} glass={false} count={3} speed={s.speed} energy={s.energy} listening
              amplitude={1} waviness={1.6} spread={1} glow={1.4} intensity={1.15}
              interactive={false} clickPulse={false} />
          </span>
        : <i className="dot" />}
      <span className="statusHint" role="tooltip" aria-hidden><i className="dot" /><b>{shownLabel}</b>{shownHint}</span>
    </span>
  );
});

const SPLASH_MS = 4200;
const SPLASH_FADE_MS = 700;

/** Intro screen shown once per page load (skipped when landing on a 404): logo + name over monochrome Magic Rings. */
export function Splash({
  light,
  skip,
  title = "PARA",
  subtitle = "Agent Mission Control",
}: {
  light?: boolean;
  skip?: boolean;
  title?: string;
  subtitle?: string;
} = {}) {
  const isLight = light ?? !dark.value;
  const [phase, setPhase] = useState<"show" | "leave" | "gone">(() => ((skip ?? notFound.peek()) ? "gone" : "show"));
  useEffect(() => {
    if (phase === "gone") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? 900 : SPLASH_MS;
    const leave = setTimeout(() => setPhase("leave"), hold);
    const gone = setTimeout(() => setPhase("gone"), hold + SPLASH_FADE_MS);
    return () => { clearTimeout(leave); clearTimeout(gone); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div className={`splash ${phase === "leave" ? "leave" : ""}`} aria-hidden>
      <MagicRings className="splashRings" theme={isLight ? "light" : "dark"}
        color={isLight ? "#15181D" : "#F4F6F9"} colorTwo={isLight ? "#9CA3AF" : "#6B7280"}
        ringCount={7} speed={0.8} glow={isLight ? 0.6 : 1.2} baseRadius={0.3} radiusStep={0.09} clickBurst={false} />
      <div className="splashBrand">
        <Logo light={isLight} />
        <BrandName light={isLight} text={title} />
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

/** App-wide loading indicator (React Bits Lattice Loader) in the PARA ice tone; props override the defaults. */
export function Loader(props: LatticeLoaderProps) {
  return <LatticeLoader pattern="orbit" shape="round" color="var(--ice)" glow showTimer={false} {...props} />;
}

const GLOW_COLORS = ["#c084fc", "#f472b6", "#38bdf8"];

export interface GlowCardProps {
  children: ReactNode;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  /** Keep the glow sweeping without hover (e.g. while a session is working). */
  active?: boolean;
  light?: boolean;
  colors?: string[];
}

/** Card hover effect: React Bits Border Glow (purple / pink / sky palette); the child provides the card content. */
export function GlowCard({ children, radius = 14, className = "", style, active = false, light, colors = GLOW_COLORS }: GlowCardProps) {
  const isLight = light ?? !dark.value;
  return (
    <BorderGlow className={`glowCard ${className}`} borderRadius={radius} glowRadius={28} edgeSensitivity={25} coneSpread={22}
      backgroundColor={isLight ? "#FFFFFF" : "#16171B"} glowColor={isLight ? "270 75 60" : "270 95 75"}
      colors={colors} glowIntensity={isLight ? 0.9 : 1} fillOpacity={0.35} style={style} active={active}>
      {children}
    </BorderGlow>
  );
}

/** Click sparks on every button across the whole app; the layer sits above the header, menus and drawer. */
export function PageSpark({
  children,
  light,
  selector = "button, a, [role='button'], [role='menuitem'], [data-para-spark]",
  sparkColor,
}: {
  children: ReactNode;
  light?: boolean;
  selector?: string;
  sparkColor?: string | string[];
}) {
  const isLight = light ?? !dark.value;
  return (
    <ClickSpark selector={selector} sparkColor={sparkColor ?? (isLight ? ["#2F7FC4", "#3F6487"] : ["#7FB7E8", "#F4F6F9"])}
      sparkSize={10} sparkRadius={22} sparkCount={8} duration={420} layerZIndex={100} style={{ height: "auto", minHeight: "100vh" }}>
      {children}
    </ClickSpark>
  );
}

/** Tweens from the previous value to the new one so KPI changes are visible. */
export function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || from.current === value) { from.current = value; setShown(value); return; }
    const start = performance.now(), a = from.current, d = duration;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / d), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown}</>;
}
