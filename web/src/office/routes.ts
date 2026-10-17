import type { OfficeLayout } from "./layout";
import type { Vec3, OfficeModel, WorkerSlot } from "./types";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]);
export function isWalkable(l: OfficeLayout, p: Vec3) {
  return (
    p[0] > l.bounds.x + 0.2 &&
    p[0] < l.bounds.x + l.bounds.width - 0.2 &&
    p[2] > l.bounds.z + 0.2 &&
    p[2] < l.bounds.z + l.bounds.depth - 0.2 &&
    !l.obstacles.some(
      (r) =>
        p[0] > r.x - 0.2 &&
        p[0] < r.x + r.width + 0.2 &&
        p[2] > r.z - 0.2 &&
        p[2] < r.z + r.depth + 0.2,
    )
  );
}
const cache = new WeakMap<OfficeLayout, Map<string, readonly Vec3[]>>();
export function findRoute(
  l: OfficeLayout,
  from: Vec3,
  to: Vec3,
): readonly Vec3[] {
  let routes = cache.get(l);
  if (!routes) {
    routes = new Map();
    cache.set(l, routes);
  }
  const key = `${from.join()}:${to.join()}`;
  if (routes.has(key)) return routes.get(key)!;
  const grid = (p: Vec3) => [Math.round(p[0] * 2), Math.round(p[2] * 2)];
  const start = grid(from),
    end = grid(to),
    id = (p: number[]) => p.join(",");
  const queue = [start],
    prev = new Map<string, number[] | null>([[id(start), null]]);
  let found = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const p = queue[cursor];
    if (id(p) === id(end)) {
      found = true;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const q = [p[0] + dx, p[1] + dz];
      if (prev.has(id(q)) || !isWalkable(l, [q[0] / 2, 0, q[1] / 2])) continue;
      prev.set(id(q), p);
      queue.push(q);
    }
  }
  if (!found) throw new Error(`No office route: ${key}`);
  const path: Vec3[] = [];
  let p: number[] | null = end;
  while (p) {
    path.unshift([p[0] / 2, 0, p[1] / 2]);
    p = prev.get(id(p)) ?? null;
  }
  path[0] = from;
  path[path.length - 1] = to;
  const simplified = path.filter(
    (p, i) =>
      i === 0 ||
      i === path.length - 1 ||
      (p[0] - path[i - 1][0]) * (path[i + 1][2] - p[2]) !==
        (p[2] - path[i - 1][2]) * (path[i + 1][0] - p[0]),
  );
  routes.set(key, simplified);
  return simplified;
}
export const pathDuration = (points: readonly Vec3[]) =>
  (points.slice(1).reduce((total, p, i) => total + distance(points[i], p), 0) /
    2.2) *
  1000;
export function workerPath(
  layout: OfficeLayout,
  worker: WorkerSlot,
  model: OfficeModel,
  floorId: string,
  workers: readonly WorkerSlot[],
): readonly Vec3[] {
  const seat = layout.seats.find((s) => s.id === worker.seatId)!;
  if (worker.phase === "entering")
    return [...findRoute(layout, layout.entry, seat.approach), seat.position];
  if (worker.phase !== "leaving") return [seat.position];
  const origin = model.delegations.find(
    (d) =>
      d.targetId === worker.sessionId &&
      ["assigned", "result_fed"].includes(d.status),
  )?.originId;
  const parent = workers.find((w) => w.sessionId === origin);
  const recipient =
    origin === floorId
      ? layout.leads.coordinator
      : parent
        ? layout.seats.find((s) => s.id === parent.seatId)?.approach
        : undefined;
  // Deliver a completed report to the observed delegator on the departure route.
  return recipient
    ? [
        seat.position,
        ...findRoute(layout, seat.approach, recipient),
        ...findRoute(layout, recipient, layout.entry).slice(1),
      ]
    : [seat.position, ...findRoute(layout, seat.approach, layout.entry)];
}
export const routeDuration = (l: OfficeLayout, from: Vec3, to: Vec3) => {
  const p = findRoute(l, from, to);
  return (
    (p.slice(1).reduce((sum, v, i) => sum + distance(p[i], v), 0) / 2.2) * 1000
  );
};
