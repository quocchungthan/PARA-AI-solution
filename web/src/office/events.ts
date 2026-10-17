import type { OfficeModel, OfficeEvent } from "./types";
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
      events.push({
        id: `done:${id}:${nowMs}`,
        floorId,
        sessionId: id,
        kind: "report",
        createdAt: nowMs,
        originId: next.delegations.find(
          (d) => d.targetId === id && floor.sessionIds.includes(d.originId),
        )?.originId,
      });
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
    if (d.status === "assigned" || d.status === "result_fed")
      events.push({
        id: `${d.key}:${d.status}:${nowMs}`,
        floorId,
        kind: d.status === "result_fed" ? "report" : "handoff",
        sessionId: d.targetId,
        originId: d.originId,
        delegationKey: d.key,
        createdAt: nowMs,
      });
  }
  return events;
}
