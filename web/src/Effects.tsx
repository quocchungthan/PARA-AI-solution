import { Suspense, lazy, memo, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Hexagon } from "@phosphor-icons/react";
import { dark, notFound } from "./store";
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
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
})();

// Memoised so the 1s clock re-render of the header never reaches the WebGL canvas.
export const Logo = memo(function Logo({ light }: { light: boolean }) {
  if (!hasWebGL2) return <span className="logo fallback"><Hexagon weight="fill" /></span>;
  return (
    <span className="logo" aria-hidden>
      <MetallicPaint imageSrc={HEXAGON} lightMode={light} color={light ? "#5B6370" : "#ffffff"}
        speed={0.35} scale={0.9} mouseTilt={0.6} dispersion={0.25} />
    </span>
  );
});

export const BrandName = memo(function BrandName({ light }: { light: boolean }) {
  return (
    <ShinyText text="PARA" className="brandName" speed={2.4} delay={2.5}
      color={light ? "#3A4250" : "#A0A6B0"} shineColor={light ? "#7FB7E8" : "#FFFFFF"} />
  );
});

export function OfflineTitle() {
  const light = !dark.value;
  const title = "Bridge service is not running";
  return (
    <Suspense fallback={<h2 className="offlineFall static">{title}</h2>}>
      <FallingText text={title} highlightWords={["not", "running"]}
        trigger="auto" restoreDelay={2.2} gravity={0.9} bounciness={0.35} fontSize="clamp(22px, 3.2vw, 32px)"
        accentColor={light ? "#C93848" : "#F07882"} theme={light ? "light" : "dark"} className="offlineFall" />
    </Suspense>
  );
}

/** "404" in React Bits Fuzzy Text, cool monochrome (slate white/gray/black) without RGB split; fuzz swells on hover. */
export function NotFoundTitle() {
  const light = !dark.value;
  return (
    <div className="notFoundCode">
      <FuzzyText fontSize="clamp(96px, 18vw, 180px)" fontWeight={900} color={light ? "#14181D" : "#F4F6F9"}
        gradient={light ? ["#0F172A", "#334155", "#64748B"] : ["#F8FAFC", "#CBD5E1", "#64748B"]} baseIntensity={0.16} hoverIntensity={0.45} fuzzRange={24}
        glitchMode glitchInterval={2600} glitchDuration={220} colorSplit={0}>404</FuzzyText>
    </div>
  );
}

/** Full-page Letter Glitch backdrop for the "bridge is not running" screen: gray glyphs with the offline red. */
export function OfflineBackdrop() {
  const light = !dark.value;
  if (!hasWebGL2) return null;
  return (
    <div className="offlineBg" aria-hidden>
      <LetterGlitch lightMode={light} backgroundColor={light ? "#F3F4F6" : "#09090B"}
        baseColor={light ? "#6B7280" : "#9CA3AF"}
        glitchColors={light ? ["#18181b", "#C93848"] : ["#F4F6F9", "#F07882"]}
        baseOpacity={light ? 0.12 : 0.14} glitchAmount={0.45} speed={0.8} edgeFade={0.15} />
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
export const StatusOrb = memo(function StatusOrb({ online }: { online: boolean | null }) {
  const key = online ? "online" : online === false ? "offline" : "connecting";
  const s = STATUS[key];
  return (
    <span className="statusOrb" data-state={key} role="status" tabIndex={0} aria-label={`${s.label}: ${s.hint}`}>
      {hasWebGL2
        ? <span className="orbCore">
            <Strands colors={[...s.colors]} glass={false} count={3} speed={s.speed} energy={s.energy} listening
              amplitude={1} waviness={1.6} spread={1} glow={1.4} intensity={1.15}
              interactive={false} clickPulse={false} />
          </span>
        : <i className="dot" />}
      <span className="statusHint" role="tooltip" aria-hidden><i className="dot" /><b>{s.label}</b>{s.hint}</span>
    </span>
  );
});

const SPLASH_MS = 4200;
const SPLASH_FADE_MS = 700;

/** Intro screen shown once per page load (skipped when landing on a 404): logo + name over monochrome Magic Rings. */
export function Splash() {
  const light = !dark.value;
  const [phase, setPhase] = useState<"show" | "leave" | "gone">(() => (notFound.peek() ? "gone" : "show"));
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
      <MagicRings className="splashRings" theme={light ? "light" : "dark"}
        color={light ? "#15181D" : "#F4F6F9"} colorTwo={light ? "#9CA3AF" : "#6B7280"}
        ringCount={7} speed={0.8} glow={light ? 0.6 : 1.2} baseRadius={0.3} radiusStep={0.09} clickBurst={false} />
      <div className="splashBrand">
        <Logo light={light} />
        <BrandName light={light} />
        <small>Agent Mission Control</small>
      </div>
    </div>
  );
}

/** App-wide loading indicator (React Bits Lattice Loader) in the PARA ice tone; props override the defaults. */
export function Loader(props: LatticeLoaderProps) {
  return <LatticeLoader pattern="orbit" shape="round" color="var(--ice)" glow showTimer={false} {...props} />;
}

const GLOW_COLORS = ["#c084fc", "#f472b6", "#38bdf8"];

interface GlowCardProps {
  children: ReactNode;
  radius: number;
  className?: string;
  style?: CSSProperties;
  /** Keep the glow sweeping without hover (e.g. while a session is working). */
  active?: boolean;
}

/** Card hover effect: React Bits Border Glow (purple / pink / sky palette); the child provides the card content. */
export function GlowCard({ children, radius, className = "", style, active = false }: GlowCardProps) {
  const light = !dark.value;
  return (
    <BorderGlow className={`glowCard ${className}`} borderRadius={radius} glowRadius={28} edgeSensitivity={25} coneSpread={22}
      backgroundColor={light ? "#FFFFFF" : "#16171B"} glowColor={light ? "270 75 60" : "270 95 75"}
      colors={GLOW_COLORS} glowIntensity={light ? 0.9 : 1} fillOpacity={0.35} style={style} active={active}>
      {children}
    </BorderGlow>
  );
}

/** Click sparks on every button across the whole app; the layer sits above the header, menus and drawer. */
export function PageSpark({ children }: { children: ReactNode }) {
  const light = !dark.value;
  return (
    <ClickSpark selector="button, a, [role='button'], [role='menuitem']" sparkColor={light ? ["#2F7FC4", "#3F6487"] : ["#7FB7E8", "#F4F6F9"]}
      sparkSize={10} sparkRadius={22} sparkCount={8} duration={420} layerZIndex={100} style={{ height: "auto", minHeight: "100vh" }}>
      {children}
    </ClickSpark>
  );
}
