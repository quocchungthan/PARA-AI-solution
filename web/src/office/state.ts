import { effect, signal } from "@preact/signals-react";
import { snapshot, serviceOnline, openSession } from "../store";
import { deriveOfficeModel, deriveOfficeNotices } from "./model";
import {
  createOfficeRuntime,
  reduceOffice,
  type OfficeAction,
} from "./runtime";
import type { OfficeRuntime } from "./types";
export const officeRuntime = signal<OfficeRuntime | null>(null);
export const dismissedOfficeNotices = signal<ReadonlySet<string>>(new Set());
effect(() => {
  if (openSession.value && officeRuntime.value?.selection)
    dispatchOffice({ type: "select", selection: null });
});
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
  const liveIds = new Set(
    deriveOfficeNotices(officeRuntime.peek()!.model).map((n) => n.id),
  );
  const dismissed = dismissedOfficeNotices.peek();
  if ([...dismissed].some((id) => !liveIds.has(id)))
    dismissedOfficeNotices.value = new Set(
      [...dismissed].filter((id) => liveIds.has(id)),
    );
});
export function focusOfficeSession(floorId: string, sessionId: string) {
  let runtime = officeRuntime.peek();
  if (!runtime) return;
  if (runtime.selectedFloorId !== floorId)
    runtime = reduceOffice(runtime, { type: "selectFloor", floorId });
  runtime = reduceOffice(runtime, { type: "revealWorker", floorId, sessionId });
  officeRuntime.value = reduceOffice(runtime, {
    type: "select",
    selection: { kind: "session", floorId, sessionId },
  });
}
