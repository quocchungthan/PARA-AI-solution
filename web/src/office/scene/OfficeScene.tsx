import { useMemo, type ReactNode } from "react";
import type { OfficeLayout } from "../layout";
import { botanicalPalette } from "./palette";
import { RoomShell } from "./RoomShell";
import { Furniture } from "./Furniture";
import { Plants } from "./Plants";
import { Lighting } from "./Lighting";
export function OfficeScene({
  layout,
  theme,
  children,
}: {
  layout: OfficeLayout;
  theme: "light" | "dark";
  children?: ReactNode;
}) {
  const p = useMemo(() => botanicalPalette(theme), [theme]);
  return (
    <>
      <color attach="background" args={[p.background]} />
      <Lighting p={p} />
      <RoomShell layout={layout} p={p} />
      <Furniture layout={layout} p={p} />
      <Plants p={p} />
      {children}
    </>
  );
}
