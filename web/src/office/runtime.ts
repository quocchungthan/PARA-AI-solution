import type { CameraPose, SharedOfficeEvent, SharedOfficeModel, SharedOfficeRuntime, SharedOfficeSelection, WorkerSlot } from "./types";
import { getOfficeStyle } from "./styles/registry";
import type { OfficeStyleId } from "./styles/types";
import type { OfficePreferences } from "./styles/preferences";
import { pathDuration, sharedWorkerPath } from "./routes";
import { officeRole } from "./roles";
import { presentSession } from "./model";
import { collectSharedOfficeEvents } from "./events";

export type SharedOfficeAction =
  | { type: "snapshot"; model: SharedOfficeModel; nowMs: number }
  | { type: "connectivity"; online: boolean; nowMs: number }
  | { type: "select"; selection: SharedOfficeSelection }
  | { type: "revealWorker"; sessionId: string; nowMs: number }
  | { type: "camera"; styleId: OfficeStyleId; pose: CameraPose }
  | { type: "style"; styleId: OfficeStyleId; nowMs: number }
  | { type: "tick"; nowMs: number };

export const sessionActorId = (sessionId: string) => JSON.stringify(["session", sessionId]);
const CAPACITY = 10, TRANSITIONS = 2;
const liveIds = (m: SharedOfficeModel) => m.sessionIds.filter(id => m.sessionsById.get(id)!.state !== "done");
const transient = (w: WorkerSlot) => w.phase !== "seated";

function allocate(id: string, m: SharedOfficeModel, workers: readonly WorkerSlot[], now: number, phase: WorkerSlot["phase"], styleId: OfficeStyleId): WorkerSlot {
  const seats = getOfficeStyle(styleId).layout.seats.filter(s => !s.reservedFor);
  const free = seats.filter(s => !workers.some(w => w.seatId === s.id));
  const role = officeRole(m.sessionsById.get(id)?.agent);
  const seat = free.find(s => s.rolePreference === role) ?? free.find(s => !s.rolePreference) ?? free[0];
  return { sessionId: id, seatId: seat.id, identitySeed: id, phase, phaseStartedAt: now };
}

function fill(m: SharedOfficeModel, workers: readonly WorkerSlot[], now: number, styleId: OfficeStyleId, arrivals: ReadonlySet<string> = new Set()): WorkerSlot[] {
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
    next.push(allocate(id, m, next, now, entering ? "entering" : "seated", styleId));
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

export function createSharedOfficeRuntime(model: SharedOfficeModel, online: boolean, nowMs: number, preferences?: OfficePreferences): SharedOfficeRuntime {
  const styleId=preferences?.styleId??'botanical', camerasByStyle=preferences?.camerasByStyle??{};
  return { model, online, styleId, camerasByStyle, selection: null, workers: fill(model, [], nowMs, styleId), queue: [], camera: camerasByStyle[styleId]??null };
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
  workers = fill(model, workers, now, state.styleId, new Set(events.filter(e => e.kind === "arrive").map(e => e.sessionId)));
  return { ...state, model, workers, queue: quiet ? [] : admit([...state.queue, ...events], model, now) };
}

export function reduceSharedOffice(state: SharedOfficeRuntime, action: SharedOfficeAction): SharedOfficeRuntime {
  if (action.type === "snapshot") return reconcile(state, action.model, action.nowMs, !state.online);
  if (action.type === "connectivity") return action.online === state.online ? state :
    reconcile({ ...state, online: action.online }, state.model, action.nowMs, true);
  if (action.type === "select") return { ...state, selection: action.selection };
  if (action.type === "camera") return action.styleId !== state.styleId ? state : { ...state, camera: action.pose, camerasByStyle: {...state.camerasByStyle, [state.styleId]: action.pose} };
  if (action.type === "style") {
    if (action.styleId === state.styleId) return state;
    const oldLayout=getOfficeStyle(state.styleId).layout, layout=getOfficeStyle(action.styleId).layout;
    const remapped:WorkerSlot[]=[];
    for(const w of state.workers) {
      const remembered=layout.seats.find(s=>s.id===w.seatId&&!s.reservedFor&&!remapped.some(v=>v.seatId===s.id));
      const allocated=allocate(w.sessionId,state.model,remapped,action.nowMs,w.phase,action.styleId);
      remapped.push({...w,seatId:remembered?.id??allocated.seatId});
    }
    const workers=remapped.map((w,i)=>{
      if(!['entering','leaving'].includes(w.phase))return w;
      const oldDuration=pathDuration(sharedWorkerPath(oldLayout,state.workers[i],state.model,state.workers));
      const duration=pathDuration(sharedWorkerPath(layout,w,state.model,remapped));
      const progress=oldDuration>0?Math.max(0,Math.min(1,(action.nowMs-w.phaseStartedAt)/oldDuration)):1;
      return {...w,phaseStartedAt:action.nowMs-progress*duration};
    });
    const camerasByStyle={...state.camerasByStyle,...(state.camera?{[state.styleId]:state.camera}:{})};
    return {...state,styleId:action.styleId,workers,camerasByStyle,camera:camerasByStyle[action.styleId]??null};
  }
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
    workers.push(allocate(action.sessionId, state.model, workers, action.nowMs, "seated", state.styleId));
    return { ...state, workers };
  }
  if (action.type === "tick" && state.online) {
    const workers = state.workers.flatMap(w => {
      const elapsed = action.nowMs - w.phaseStartedAt;
      if (w.phase === "reporting" && elapsed >= 1500) return [{ ...w, phase: "leaving" as const, phaseStartedAt: action.nowMs }];
      if (["entering", "leaving"].includes(w.phase) && elapsed >= pathDuration(sharedWorkerPath(getOfficeStyle(state.styleId).layout, w, state.model, state.workers)))
        return w.phase === "leaving" ? [] : [{ ...w, phase: "seated" as const, phaseStartedAt: action.nowMs }];
      return [w];
    });
    const next = fill(state.model, workers, action.nowMs, state.styleId), queue = admit(state.queue, state.model, action.nowMs);
    if (next.length === state.workers.length && next.every((w, i) => w === state.workers[i]) &&
      queue.length === state.queue.length && queue.every((e, i) => e === state.queue[i])) return state;
    return { ...state, workers: next, queue };
  }
  return state;
}
