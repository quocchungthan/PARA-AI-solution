import type { OfficeRole, Vec3 } from "../../types";
import type { Rect, Seat, Room, Wall, OfficeLayout } from "../../layout";
import { createWalkGraph } from "../../routes";
import { BOTANICAL_FURNITURE } from "./furniture";
const desks: Rect[] = [];
const seats: Seat[] = [];
const teamRoles: OfficeRole[] = [
  "coder",
  "reviewer",
  "functional-reviewer",
  "scrum-master",
];
for (let i = 0; i < 4; i++) {
  const x = i % 2 === 0 ? -7 : 3,
    z = i < 2 ? 1 : 6;
  desks.push({ x: x - 3, z: z - 1, width: 6, depth: 2 });
  for (let j = 0; j < 4; j++) {
    const xx = x + (j % 2 === 0 ? -1.5 : 1.5),
      zz = z + (j < 2 ? -1.9 : 1.9);
    seats.push({
      id: `team-${i}-${j}`,
      position: [xx, 0, zz],
      approach: [xx, 0, z + (j < 2 ? -2.5 : 2.5)],
      rotation: j < 2 ? 0 : Math.PI,
      reservedFor: j === 2 ? teamRoles[i] : undefined,
    });
  }
}
// Small stations share the same seat/desk dimensions as the team islands.
for (let i = 0; i < 3; i++) {
  const x = -13 + i * 1.8,
    z = -7.5;
  desks.push({ x: x - 0.7, z: z - 0.7, width: 1.4, depth: 1.4 });
  seats.push({
    id: `research-${i}`,
    position: [x, 0, -5.8],
    approach: [x, 0, -5],
    rotation: Math.PI,
    rolePreference: "researcher",
    reservedFor: i === 0 ? "researcher" : undefined,
  });
}
desks.push(
  { x: 9, z: -8.4, width: 4, depth: 1.6 },
  { x: -7, z: -8.4, width: 4, depth: 1.6 },
  { x: -2.8, z: -6.5, width: 2, depth: 1.4 },
  { x: 2, z: -8, width: 3, depth: 2 },
);
seats.push(
  {
    id: "hr-lead",
    position: [10, 0, -5.8],
    approach: [10, 0, -5],
    rotation: Math.PI,
    reservedFor: "hr",
  },
  {
    id: "hr-worker",
    position: [12, 0, -5.8],
    approach: [12, 0, -5],
    rotation: Math.PI,
    rolePreference: "hr",
  },
);
seats.push({ id: 'coordinator-lead', position: [-1.8,0,-4.3], approach: [-1.8,0,-3.8], rotation: Math.PI, reservedFor: 'coordinator' });
const rooms: Room[] = [
  {
    id: "management",
    name: "Manager + assistant",
    x: -8,
    z: -10,
    width: 8,
    depth: 7,
  },
  { id: "research", name: "Research", x: -15, z: -10, width: 7, depth: 7 },
  { id: "creative", name: "Creative space", x: 0, z: -10, width: 7, depth: 7 },
  { id: "hr", name: "Capabilities · HR", x: 7, z: -10, width: 8, depth: 7 },
  { id: "team", name: "Team workspace", x: -15, z: -3, width: 25, depth: 13 },
  { id: "pantry", name: "Pantry / lounge", x: 10, z: -3, width: 5, depth: 13 },
];
const doors: Vec3[] = [
  [-11.5, 0, -3],
  [-4, 0, -3],
  [3.5, 0, -3],
  [11.5, 0, -3],
];
const walls: Wall[] = [
  { from: [-15, 0, -10], to: [15, 0, -10], height: 3.8, cutawayHeight: 3.8 },
  { from: [-15, 0, -10], to: [-15, 0, 10], height: 3.8, cutawayHeight: 0.7 },
  { from: [15, 0, -10], to: [15, 0, 10], height: 3.8, cutawayHeight: 0.7 },
  { from: [-15, 0, 10], to: [10, 0, 10], height: 3.8, cutawayHeight: 0.55 },
  { from: [13, 0, 10], to: [15, 0, 10], height: 3.8, cutawayHeight: 0.55 },
];
for (const x of [-8, 0, 7])
  walls.push({
    from: [x, 0, -10],
    to: [x, 0, -3],
    height: 3.8,
    cutawayHeight: 1.6,
  });
for (const r of rooms.slice(0, 4)) {
  const door = doors.find((d) => d[0] > r.x && d[0] < r.x + r.width)!;
  for (const [a, b] of [
    [r.x, door[0] - 1],
    [door[0] + 1, r.x + r.width],
  ])
    walls.push({
      from: [a, 0, -3],
      to: [b, 0, -3],
      height: 3.8,
      cutawayHeight: 1.15,
    });
}
const wallRects = walls.map((w) => ({
  x: Math.min(w.from[0], w.to[0]) - 0.12,
  z: Math.min(w.from[2], w.to[2]) - 0.12,
  width: Math.abs(w.to[0] - w.from[0]) + 0.24,
  depth: Math.abs(w.to[2] - w.from[2]) + 0.24,
}));
const leads = Object.fromEntries(
  seats.filter((s) => s.reservedFor).map((s) => [s.reservedFor, s.position]),
) as OfficeLayout["leads"];
leads.coordinator = [-1.8, 0, -4.3];
export const BOTANICAL_LAYOUT: OfficeLayout = {
  bounds: { x: -15, z: -10, width: 30, depth: 20 },
  rooms,
  desks,
  obstacles: [
    ...desks,
    ...wallRects,
    { x: 13.3, z: -1.5, width: 1.4, depth: 5 },
    BOTANICAL_FURNITURE.sofa,
    BOTANICAL_FURNITURE.backrest,
    ...BOTANICAL_FURNITURE.arms,
    BOTANICAL_FURNITURE.table,
  ],
  walls,
  doors,
  seats,
  leads,
  human: [-5, 0, -5.8],
  humanRotation: Math.PI,
  entry: [11.5, 0, 9.5],
  floorAreas: [{ x: -15, z: -10, width: 30, depth: 20 }],
  restSeats: [11.5,13].map((x,i) => ({ id: 'lounge-'+i, position: [x,0,6.5] as Vec3, approach: [x,0,7.5] as Vec3, rotation: 0 })),
  walkGraph: { nodes: [], edges: [] },
};
BOTANICAL_LAYOUT.walkGraph = createWalkGraph(BOTANICAL_LAYOUT);
