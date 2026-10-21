import { lazy, useMemo, type ReactNode } from "react";
import type { OfficeStyleId } from '../styles/types';
import type { OfficeLayout } from "../layout";
import { botanicalPalette } from "./palette";
import { RoomShell } from "./RoomShell";
import { Furniture } from "./Furniture";
import { Plants } from "./Plants";
import { Lighting } from "./Lighting";
import { SceneResources } from "./resources";
// The lazy component must survive an initial suspense retry. A component-local
// useMemo is discarded when that component has not committed yet.
function precinctLoader(retry:number) {
  return lazy(async()=>{
    try {return await import('../styles/precinct/scene');}
    catch(error) {
      const url=String(error).match(/https?:\/\/[^\s]+/)?.[0];
      if(!retry||!url)throw error;
      return import(/* @vite-ignore */ url+(url.includes('?')?'&':'?')+'office-retry='+retry);
    }
  });
}
let lazyRetry=0, lazyPrecinct=precinctLoader(0);
function getPrecinctScene(retry:number) {
  if(retry!==lazyRetry){lazyRetry=retry;lazyPrecinct=precinctLoader(retry);}
  return lazyPrecinct;
}

export function OfficeScene({
  layout,
  theme,
  children,
  styleId='botanical',
  cutaway=true,
  retry=0,
}: {
  layout: OfficeLayout;
  theme: "light" | "dark";
  children?: ReactNode;
  styleId?: OfficeStyleId;
  cutaway?: boolean;
  retry?: number;
}) {
  const PrecinctScene=getPrecinctScene(retry);
  const p = useMemo(() => botanicalPalette(theme), [theme]);
  return (
    <SceneResources>
      {styleId==='precinct'?<PrecinctScene theme={theme} cutaway={cutaway}>{children}</PrecinctScene>:<>
      <color attach="background" args={[p.background]} />
      <Lighting p={p} />
      <RoomShell layout={layout} p={p} cutaway={cutaway} />
      <Furniture layout={layout} p={p} />
      <Plants p={p} />
      {children}
      </>}
    </SceneResources>
  );
}
