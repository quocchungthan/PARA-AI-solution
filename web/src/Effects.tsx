import { Suspense, lazy, memo, type ReactNode } from "react";
import { Hexagon } from "@phosphor-icons/react";
import { dark } from "./store";
import ShinyText from "./reactbits/ShinyText/ShinyText";
import MetallicPaint from "./reactbits/MetallicPaint/MetallicPaint";
import ClickSpark from "./reactbits/ClickSpark/ClickSpark";

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

export function SessionSpark({ children }: { children: ReactNode }) {
  const light = !dark.value;
  return (
    <ClickSpark selector="button, [role='button']" sparkColor={light ? ["#2F7FC4", "#3F6487"] : ["#7FB7E8", "#F4F6F9"]}
      sparkSize={10} sparkRadius={22} sparkCount={8} duration={420} style={{ height: "auto" }}>
      {children}
    </ClickSpark>
  );
}
