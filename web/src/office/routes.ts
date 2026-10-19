import type { OfficeLayout } from "./layout";
import type { Vec3, WorkerSlot, SharedOfficeModel } from "./types";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]);
export function isWalkable(l: OfficeLayout, p: Vec3) {
  const onFloor = (x: number, z: number) => l.floorAreas.some(r =>
    x >= r.x && x <= r.x+r.width && z >= r.z && z <= r.z+r.depth);
  return (
    p[0] > l.bounds.x + 0.2 &&
    p[0] < l.bounds.x + l.bounds.width - 0.2 &&
    p[2] > l.bounds.z + 0.2 &&
    p[2] < l.bounds.z + l.bounds.depth - 0.2 &&
    onFloor(p[0],p[2]) &&
    [[-.2,0],[.2,0],[0,-.2],[0,.2]].every(([x,z]) => onFloor(p[0]+x,p[2]+z)) &&
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
export function createWalkGraph(
  layout: OfficeLayout,
): OfficeLayout["walkGraph"] {
  const nodes: Vec3[] = [],
    edges: [number, number][] = [],
    indices = new Map<string, number>();
  for (
    let x = layout.bounds.x + 0.5;
    x < layout.bounds.x + layout.bounds.width;
    x += 0.5
  )
    for (
      let z = layout.bounds.z + 0.5;
      z < layout.bounds.z + layout.bounds.depth;
      z += 0.5
    ) {
      const p: Vec3 = [x, 0, z];
      if (!isWalkable(layout, p)) continue;
      indices.set(`${x},${z}`, nodes.length);
      nodes.push(p);
    }
  nodes.forEach((p, i) => {
    for (const [dx, dz] of [
      [0.5, 0],
      [0, 0.5],
    ]) {
      const j = indices.get(`${p[0] + dx},${p[2] + dz}`);
      if (j !== undefined) edges.push([i, j]);
    }
  });
  return { nodes, edges };
}
const graphCache = new WeakMap<
  OfficeLayout,
  { indices: Map<string, number>; neighbors: Map<number, number[]> }
>();
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
  // Only the final front-to-cushion segment is a seating transition. The
  // circulation graph excludes the entire sofa, its backrest, arms and table.
  const access = (p: Vec3) => {
    const seat = l.restSeats.find(s => {
      const a=s.position, b=s.approach;
      return Math.abs((p[0]-a[0])*(b[2]-a[2])-(p[2]-a[2])*(b[0]-a[0])) < .001 &&
        p[0]>=Math.min(a[0],b[0])-.001 && p[0]<=Math.max(a[0],b[0])+.001 &&
        p[2]>=Math.min(a[2],b[2])-.001 && p[2]<=Math.max(a[2],b[2])+.001;
    });
    return seat ? seat.approach : p;
  };
  const walkFrom = access(from),
    walkTo = access(to);
  let graph = graphCache.get(l);
  if (!graph) {
    const indices = new Map(
      l.walkGraph.nodes.map((p, i) => [`${p[0]},${p[2]}`, i]),
    );
    const neighbors = new Map<number, number[]>();
    for (const [a, b] of l.walkGraph.edges) {
      if (!neighbors.has(a)) neighbors.set(a, []);
      if (!neighbors.has(b)) neighbors.set(b, []);
      neighbors.get(a)!.push(b);
      neighbors.get(b)!.push(a);
    }
    graph = { indices, neighbors };
    graphCache.set(l, graph);
  }
  const id = (p: Vec3) =>
    `${Math.round(p[0] * 2) / 2},${Math.round(p[2] * 2) / 2}`;
  const start = graph.indices.get(id(walkFrom)),
    end = graph.indices.get(id(walkTo));
  if (start === undefined || end === undefined)
    throw new Error(`No office route endpoint: ${key}`);
  const queue = [start],
    prev = new Map<number, number | null>([[start, null]]);
  let found = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const p = queue[cursor];
    if (p === end) {
      found = true;
      break;
    }
    for (const q of graph.neighbors.get(p) ?? []) {
      if (prev.has(q)) continue;
      prev.set(q, p);
      queue.push(q);
    }
  }
  if (!found) throw new Error(`No office route: ${key}`);
  const path: Vec3[] = [];
  let p: number | null = end;
  while (p !== null) {
    path.unshift(l.walkGraph.nodes[p]);
    p = prev.get(p) ?? null;
  }
  path[0] = walkFrom;
  path[path.length - 1] = walkTo;
  const simplified = path.filter(
    (p, i) =>
      i === 0 ||
      i === path.length - 1 ||
      (p[0] - path[i - 1][0]) * (path[i + 1][2] - p[2]) !==
        (p[2] - path[i - 1][2]) * (path[i + 1][0] - p[0]),
  );
  const result = [
    ...(walkFrom !== from ? [from] : []),
    ...simplified,
    ...(walkTo !== to ? [to] : []),
  ];
  routes.set(key, result);
  return result;
}
export const pathDuration = (points: readonly Vec3[]) =>
  (points.slice(1).reduce((total, p, i) => total + distance(points[i], p), 0) /
    2.2) *
  1000;
export const routeDuration = (l: OfficeLayout, from: Vec3, to: Vec3) => {
  const p = findRoute(l, from, to);
  return (
    (p.slice(1).reduce((sum, v, i) => sum + distance(p[i], v), 0) / 2.2) * 1000
  );
};

export function sharedWorkerPath(layout: OfficeLayout, worker: WorkerSlot, model: SharedOfficeModel, workers: readonly WorkerSlot[]): readonly Vec3[] {
  const seat = layout.seats.find(s => s.id === worker.seatId)!;
  if (worker.phase === "entering") return [...findRoute(layout, layout.entry, seat.approach), seat.position];
  if (worker.phase !== "leaving") return [seat.position];
  const parentIds = model.delegations.filter(d => d.targetId === worker.sessionId && d.originId !== worker.sessionId &&
    ["assigned", "result_fed"].includes(d.status)).map(d => d.originId).sort();
  const parent = parentIds.map(id => workers.find(w => w.sessionId === id)).find(w => w !== undefined);
  const recipient = parent ? layout.seats.find(s => s.id === parent.seatId)!.approach : undefined;
  return recipient ? [seat.position, ...findRoute(layout, seat.approach, recipient), ...findRoute(layout, recipient, layout.entry).slice(1)] :
    [seat.position, ...findRoute(layout, seat.approach, layout.entry)];
}
