import { effect, signal } from "@preact/signals-react";
import { snapshot, serviceOnline } from "../store";
import { deriveOfficeModel } from "./model";
import {
  createOfficeRuntime,
  reduceOffice,
  type OfficeAction,
} from "./runtime";
import type { OfficeRuntime } from "./types";
export const officeRuntime = signal<OfficeRuntime | null>(null);
export function dispatchOffice(action: OfficeAction) {
  const current = officeRuntime.peek();
  if (current) officeRuntime.value = reduceOffice(current, action);
}
let lastSnapshot = snapshot.peek();
effect(() => {
  const snap = snapshot.value,
    online = serviceOnline.value === true;
  if (!snap) return;
  const nowMs = Date.now();
  if (!officeRuntime.peek())
    officeRuntime.value = createOfficeRuntime(
      deriveOfficeModel(snap),
      online,
      nowMs,
    );
  else {
    if (snap !== lastSnapshot)
      dispatchOffice({
        type: "snapshot",
        model: deriveOfficeModel(snap),
        nowMs,
      });
    dispatchOffice({ type: "connectivity", online, nowMs });
  }
  lastSnapshot = snap;
});
export function focusOfficeSession(floorId: string, sessionId: string) {
  dispatchOffice({ type: "selectFloor", floorId });
  dispatchOffice({ type: "revealWorker", floorId, sessionId });
  dispatchOffice({
    type: "select",
    selection: { kind: "session", floorId, sessionId },
  });
}
