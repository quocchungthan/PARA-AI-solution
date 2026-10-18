import type { OfficeModel, OfficeEvent } from "./types";
import type { SharedOfficeModel, SharedOfficeEvent } from "./types";
import { presentSession } from "./model";

export function collectSharedOfficeEvents(previous: SharedOfficeModel | null, next: SharedOfficeModel, nowMs: number): readonly SharedOfficeEvent[] {
  if (!previous) return [];
  const events: SharedOfficeEvent[] = [], reported = new Set<string>();
  const report = (sessionId: string, originId: string, delegationKey: string) => {
    const key = JSON.stringify([sessionId, originId]);
    if (reported.has(key)) return;
    reported.add(key);
    events.push({ id: `report:${key}:${nowMs}`, sessionId, originId, delegationKey, kind: "report", createdAt: nowMs });
  };
  for (const id of next.sessionIds) {
    const s = next.sessionsById.get(id)!, before = previous.sessionsById.get(id);
    if (!before && s.state !== "done" && presentSession(s).verified)
      events.push({ id: `arrive:${JSON.stringify(id)}:${nowMs}`, sessionId: id, kind: "arrive", createdAt: nowMs });
    if (before && before.state !== "done" && s.state === "done")
      for (const d of next.delegations)
        if (d.targetId === id && d.originId !== id && next.sessionsById.has(d.originId) && ["assigned", "result_fed"].includes(d.status))
          report(id, d.originId, d.key);
  }
  const old = new Map(previous.delegations.map(d => [d.key, d]));
  for (const d of next.delegations) {
    if (!next.sessionsById.has(d.originId) || !next.sessionsById.has(d.targetId) || d.originId === d.targetId || old.get(d.key)?.status === d.status) continue;
    if (d.status === "result_fed") report(d.targetId, d.originId, d.key);
    else if (d.status === "assigned") events.push({ id: JSON.stringify([d.key, d.status, nowMs]),
      sessionId: d.targetId, originId: d.originId, delegationKey: d.key, kind: "handoff", createdAt: nowMs });
  }
  return events;
}
export function collectOfficeEvents(
  previous: OfficeModel | null,
  next: OfficeModel,
  floorId: string,
  nowMs: number,
): readonly OfficeEvent[] {
  if (!previous) return [];
  const floor = next.floors.find((f) => f.rootId === floorId);
  if (!floor) return [];
  const events: OfficeEvent[] = [];
  const reported = new Set<string>();
  function report(sessionId: string, originId: string, delegationKey: string) {
    const key = JSON.stringify([sessionId, originId]);
    if (reported.has(key)) return;
    reported.add(key);
    events.push({
      id: `report:${key}:${nowMs}`,
      floorId,
      sessionId,
      originId,
      delegationKey,
      kind: "report",
      createdAt: nowMs,
    });
  }
  for (const id of floor.sessionIds) {
    const s = next.sessionsById.get(id)!,
      before = previous.sessionsById.get(id);
    if (
      !before &&
      id !== floorId &&
      s.registered !== false &&
      s.state !== "done"
    )
      events.push({
        id: `arrive:${id}:${nowMs}`,
        floorId,
        sessionId: id,
        kind: "arrive",
        createdAt: nowMs,
      });
    if (before?.state !== "done" && before && s.state === "done")
      for (const d of next.delegations)
        if (
          d.targetId === id &&
          floor.sessionIds.includes(d.originId) &&
          ["assigned", "result_fed"].includes(d.status)
        )
          report(id, d.originId, d.key);
  }
  const old = new Map(previous.delegations.map((d) => [d.key, d]));
  for (const d of next.delegations) {
    if (
      !floor.sessionIds.includes(d.originId) ||
      !next.sessionsById.has(d.targetId)
    )
      continue;
    const before = old.get(d.key);
    if (before?.status === d.status) continue;
    if (d.status === "result_fed") report(d.targetId, d.originId, d.key);
    else if (d.status === "assigned")
      events.push({
        id: `${d.key}:${d.status}:${nowMs}`,
        floorId,
        kind: "handoff",
        sessionId: d.targetId,
        originId: d.originId,
        delegationKey: d.key,
        createdAt: nowMs,
      });
  }
  return events;
}
