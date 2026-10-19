import { lazy, useMemo, type ReactNode } from "react";
import type { OfficeStyleId } from '../styles/types';
import type { OfficeLayout } from "../layout";
import { botanicalPalette } from "./palette";
import { RoomShell } from "./RoomShell";
import { Furniture } from "./Furniture";
import { Plants } from "./Plants";
import { Lighting } from "./Lighting";
import { SceneResources } from "./resources";
const PrecinctScene=lazy(()=>import('../styles/precinct/scene'));
export function OfficeScene({
  layout,
  theme,
  children,
  styleId='botanical',
  cutaway=true,
}: {
  layout: OfficeLayout;
  theme: "light" | "dark";
  children?: ReactNode;
  styleId?: OfficeStyleId;
  cutaway?: boolean;
}) {
  const p = useMemo(() => botanicalPalette(theme), [theme]);
  return (
    <SceneResources>
      {styleId==='precinct'?<PrecinctScene theme={theme} cutaway={cutaway}>{children}</PrecinctScene>:<>
      <color attach="background" args={[p.background]} />
      <Lighting p={p} />
      <RoomShell layout={layout} p={p} />
      <Furniture layout={layout} p={p} />
      <Plants p={p} />
      {children}
      </>}
    </SceneResources>
  );
}
