import type { CameraPose, SharedOfficeEvent, SharedOfficeModel, SharedOfficeRuntime, SharedOfficeSelection, WorkerSlot } from "./types";
import { OFFICE_LAYOUT as layout } from "./layout";
import { pathDuration, sharedWorkerPath } from "./routes";
import { officeRole } from "./roles";
import { presentSession } from "./model";
import { collectSharedOfficeEvents } from "./events";

export type SharedOfficeAction =
  | { type: "snapshot"; model: SharedOfficeModel; nowMs: number }
  | { type: "connectivity"; online: boolean; nowMs: number }
  | { type: "select"; selection: SharedOfficeSelection }
  | { type: "revealWorker"; sessionId: string; nowMs: number }
  | { type: "camera"; pose: CameraPose }
  | { type: "tick"; nowMs: number };

export const sessionActorId = (sessionId: string) => JSON.stringify(["session", sessionId]);
const seats = layout.seats.filter(s => !s.reservedFor);
const CAPACITY = 10, TRANSITIONS = 2;
const liveIds = (m: SharedOfficeModel) => m.sessionIds.filter(id => m.sessionsById.get(id)!.state !== "done");
const transient = (w: WorkerSlot) => w.phase !== "seated";

function allocate(id: string, m: SharedOfficeModel, workers: readonly WorkerSlot[], now: number, phase: WorkerSlot["phase"]): WorkerSlot {
  const free = seats.filter(s => !workers.some(w => w.seatId === s.id));
  const role = officeRole(m.sessionsById.get(id)?.agent);
  const seat = free.find(s => s.rolePreference === role) ?? free.find(s => !s.rolePreference) ?? free[0];
  return { sessionId: id, seatId: seat.id, identitySeed: id, phase, phaseStartedAt: now };
}

function fill(m: SharedOfficeModel, workers: readonly WorkerSlot[], now: number, arrivals: ReadonlySet<string> = new Set()): WorkerSlot[] {
  const next = [...workers];
  const priority = (id: string) => {
    const p = presentSession(m.sessionsById.get(id)!);
    return p.needsHuman ? 0 : p.activity === "working" ? 1 : 2;
  };
  const waiting = liveIds(m).filter(id => !workers.some(w => w.sessionId === id))
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
  for (const id of waiting) {
    if (next.length >= CAPACITY) break;
    const entering = arrivals.has(id) && m.sessionsById.get(id)!.state === "working" && next.filter(transient).length < TRANSITIONS;
    next.push(allocate(id, m, next, now, entering ? "entering" : "seated"));
  }
  return next;
}

function admit(queue: readonly SharedOfficeEvent[], m: SharedOfficeModel, now: number): SharedOfficeEvent[] {
  const fresh = queue.filter(e =>
    (e.kind !== "arrive" || m.sessionsById.get(e.sessionId)?.state === "working") &&
    (e.startedAt !== undefined ? now - e.startedAt < 1500 : now - e.createdAt < 4000)).slice(-12);
  let active = fresh.filter(e => e.startedAt !== undefined).length;
  return fresh.map(e => e.startedAt === undefined && active < TRANSITIONS ? (active++, { ...e, startedAt: now }) : e);
}

export function createSharedOfficeRuntime(model: SharedOfficeModel, online: boolean, nowMs: number): SharedOfficeRuntime {
  return { model, online, selection: null, workers: fill(model, [], nowMs), queue: [], camera: null };
}

function reconcile(state: SharedOfficeRuntime, model: SharedOfficeModel, now: number, quiet: boolean): SharedOfficeRuntime {
  const events = quiet ? [] : collectSharedOfficeEvents(state.model, model, now);
  let workers = state.workers.filter(w => model.sessionsById.has(w.sessionId));
  if (quiet) workers = workers.filter(w => model.sessionsById.get(w.sessionId)!.state !== "done")
    .map(w => ({ ...w, phase: "seated" }));
  else {
    workers = workers.map(w => {
      const s = model.sessionsById.get(w.sessionId)!;
      if (s.state === "done" && !["reporting", "leaving"].includes(w.phase)) {
        const hasRecipient = model.delegations.some(d => d.targetId === w.sessionId && d.originId !== w.sessionId &&
          model.sessionsById.has(d.originId) && ["assigned", "result_fed"].includes(d.status));
        return { ...w, phase: hasRecipient ? "reporting" as const : "leaving" as const, phaseStartedAt: now };
      }
      if ((s.state !== "done" && ["reporting", "leaving"].includes(w.phase)) || (s.state !== "working" && w.phase === "entering"))
        return { ...w, phase: "seated" as const, phaseStartedAt: now };
      return w;
    });
    let moving = 0;
    workers = workers.flatMap(w => {
      if (!transient(w) || ++moving <= TRANSITIONS) return [w];
      return model.sessionsById.get(w.sessionId)!.state === "done" ? [] : [{ ...w, phase: "seated" as const }];
    });
  }
  workers = fill(model, workers, now, new Set(events.filter(e => e.kind === "arrive").map(e => e.sessionId)));
  return { ...state, model, workers, queue: quiet ? [] : admit([...state.queue, ...events], model, now) };
}

export function reduceSharedOffice(state: SharedOfficeRuntime, action: SharedOfficeAction): SharedOfficeRuntime {
  if (action.type === "snapshot") return reconcile(state, action.model, action.nowMs, !state.online);
  if (action.type === "connectivity") return action.online === state.online ? state :
    reconcile({ ...state, online: action.online }, state.model, action.nowMs, true);
  if (action.type === "select") return { ...state, selection: action.selection };
  if (action.type === "camera") return { ...state, camera: action.pose };
  if (action.type === "revealWorker") {
    if (!state.model.sessionsById.has(action.sessionId) || state.model.sessionsById.get(action.sessionId)!.state === "done" ||
      state.workers.some(w => w.sessionId === action.sessionId)) return state;
    const workers = [...state.workers];
    if (workers.length >= CAPACITY) {
      const selectedId = state.selection?.kind === "session" ? state.selection.sessionId : null;
      let index = -1;
      for (let i = workers.length - 1; i >= 0; i--)
        if (workers[i].sessionId !== selectedId && workers[i].phase === "seated") { index = i; break; }
      if (index < 0)
        for (let i = workers.length - 1; i >= 0; i--)
          if (workers[i].sessionId !== selectedId) { index = i; break; }
      workers.splice(index < 0 ? workers.length - 1 : index, 1);
    }
    workers.push(allocate(action.sessionId, state.model, workers, action.nowMs, "seated"));
    return { ...state, workers };
  }
  if (action.type === "tick" && state.online) {
    const workers = state.workers.flatMap(w => {
      const elapsed = action.nowMs - w.phaseStartedAt;
      if (w.phase === "reporting" && elapsed >= 1500) return [{ ...w, phase: "leaving" as const, phaseStartedAt: action.nowMs }];
      if (["entering", "leaving"].includes(w.phase) && elapsed >= pathDuration(sharedWorkerPath(layout, w, state.model, state.workers)))
        return w.phase === "leaving" ? [] : [{ ...w, phase: "seated" as const, phaseStartedAt: action.nowMs }];
      return [w];
    });
    const next = fill(state.model, workers, action.nowMs), queue = admit(state.queue, state.model, action.nowMs);
    if (next.length === state.workers.length && next.every((w, i) => w === state.workers[i]) &&
      queue.length === state.queue.length && queue.every((e, i) => e === state.queue[i])) return state;
    return { ...state, workers: next, queue };
  }
  return state;
}
