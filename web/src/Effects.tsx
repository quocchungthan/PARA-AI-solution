import { Suspense, lazy, memo, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Hexagon } from "@phosphor-icons/react";
import { dark } from "./store";
import ShinyText from "./reactbits/ShinyText/ShinyText";
import MetallicPaint from "./reactbits/MetallicPaint/MetallicPaint";
import ClickSpark from "./reactbits/ClickSpark/ClickSpark";
import MagicRings from "./reactbits/MagicRings/MagicRings";
import LatticeLoader, { type LatticeLoaderProps } from "./reactbits/LatticeLoader/LatticeLoader";
import BorderGlow from "./reactbits/BorderGlow/BorderGlow";

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

const SPLASH_MS = 4200;
const SPLASH_FADE_MS = 700;

/** Intro screen shown once per page load: logo + name centred over monochrome Magic Rings. */
export function Splash() {
  const light = !dark.value;
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");
  useEffect(() => {
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

/** App-wide loading indicator (React Bits Lattice Loader) in the PARA ice tone. */
export function Loader(props: LatticeLoaderProps) {
  return <LatticeLoader pattern="orbit" shape="round" color="var(--ice)" glow showTimer={false} {...props} />;
}

const GLOW_COLORS = ["#c084fc", "#f472b6", "#38bdf8"];

/** Card hover effect: React Bits Border Glow (purple / pink / sky palette); the child provides the card content. */
export function GlowCard({ children, className = "", radius, style, active = false }: { children: ReactNode; className?: string; radius: number; style?: CSSProperties; active?: boolean }) {
  const light = !dark.value;
  return (
    <BorderGlow className={`glowCard ${className}`} borderRadius={radius} glowRadius={28} edgeSensitivity={25} coneSpread={22}
      backgroundColor={light ? "#FFFFFF" : "#16171B"} glowColor={light ? "270 75 60" : "270 95 75"}
      colors={GLOW_COLORS}
      glowIntensity={light ? 0.9 : 1} fillOpacity={0.35} style={style} active={active}>
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
