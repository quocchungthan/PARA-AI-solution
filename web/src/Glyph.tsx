import { Code, CompassTool, FlagBanner, MagnifyingGlassPlus, Robot, SealCheck, type Icon } from "@phosphor-icons/react";
import { colorOf } from "./util";

const ICONS: Record<string, Icon> = {
  coordinator: CompassTool, coder: Code, researcher: MagnifyingGlassPlus, reviewer: SealCheck, "scrum-master": FlagBanner,
};

export function AgentGlyph({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const Glyph = ICONS[name] ?? Robot;
  return (
    <span className={`glyph ${size}`} style={{ ["--c" as string]: colorOf(name) }} aria-hidden>
      <Glyph weight="duotone" />
    </span>
  );
}
