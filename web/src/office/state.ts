import { effect, signal } from "@preact/signals-react";
import { snapshot, serviceOnline, openSession } from "../store";
import { deriveSharedOfficeModel, deriveSharedOfficeNotices } from "./model";
import {
  createSharedOfficeRuntime,
  reduceSharedOffice,
  type SharedOfficeAction,
} from "./runtime";
import type { SharedOfficeRuntime } from "./types";
import {readOfficePreferences,writeOfficePreferences} from './styles/preferences';
function presentationStorage():Storage|null { try{return typeof window==='undefined'?null:window.localStorage;}catch{return null;} }
const storage=presentationStorage();
const preferences=readOfficePreferences(storage??{getItem:()=>null});
export const officeRuntime = signal<SharedOfficeRuntime | null>(null);
export const dismissedOfficeNotices = signal<ReadonlySet<string>>(new Set());
effect(() => {
  if (openSession.value && officeRuntime.value?.selection)
    dispatchOffice({ type: "select", selection: null });
});
export function dispatchOffice(action: SharedOfficeAction) {
  const current = officeRuntime.peek();
  if (current) officeRuntime.value = reduceSharedOffice(current, action);
}
let lastStyle: string | undefined, lastCameras: SharedOfficeRuntime["camerasByStyle"] | undefined;
effect(()=>{
  const state=officeRuntime.value;
  if(state&&storage&&(state.styleId!==lastStyle||state.camerasByStyle!==lastCameras)) {
    writeOfficePreferences(storage,{version:1,styleId:state.styleId,camerasByStyle:state.camerasByStyle});
    lastStyle=state.styleId;lastCameras=state.camerasByStyle;
  }
});
let lastSnapshot = snapshot.peek();
effect(() => {
  const snap = snapshot.value,
    online = serviceOnline.value === true;
  if (!snap) return;
  const nowMs = Date.now();
  if (!officeRuntime.peek())
    officeRuntime.value = createSharedOfficeRuntime(
      deriveSharedOfficeModel(snap),
      online,
      nowMs,
      preferences,
    );
  else {
    if (snap !== lastSnapshot)
      dispatchOffice({
        type: "snapshot",
        model: deriveSharedOfficeModel(snap),
        nowMs,
      });
    dispatchOffice({ type: "connectivity", online, nowMs });
  }
  lastSnapshot = snap;
  const liveIds = new Set(
    deriveSharedOfficeNotices(officeRuntime.peek()!.model).map((n) => n.id),
  );
  const dismissed = dismissedOfficeNotices.peek();
  if ([...dismissed].some((id) => !liveIds.has(id)))
    dismissedOfficeNotices.value = new Set(
      [...dismissed].filter((id) => liveIds.has(id)),
    );
});
export function focusOfficeSession(sessionId: string) {
  let runtime = officeRuntime.peek();
  if (!runtime) return;
  runtime = reduceSharedOffice(runtime, { type: "revealWorker", sessionId, nowMs: Date.now() });
  officeRuntime.value = reduceSharedOffice(runtime, { type: "select", selection: { kind: "session", sessionId } });
}
