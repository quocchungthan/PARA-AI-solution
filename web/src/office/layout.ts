import type { OfficeRole, Vec3 } from "./types";
import { createWalkGraph } from "./routes";
export type Rect = { x: number; z: number; width: number; depth: number };
export type Room = Rect & { id: string; name: string };
export type Seat = {
  id: string;
  position: Vec3;
  approach: Vec3;
  rotation: number;
  rolePreference?: OfficeRole;
  reservedFor?: OfficeRole;
};
export type Wall = {
  from: Vec3;
  to: Vec3;
  height: number;
  cutawayHeight: number;
};
export type OfficeLayout = {
  bounds: Rect;
  rooms: readonly Room[];
  desks: readonly Rect[];
  obstacles: readonly Rect[];
  walls: readonly Wall[];
  doors: readonly Vec3[];
  seats: readonly Seat[];
  leads: Record<Exclude<OfficeRole, "unknown">, Vec3>;
  human: Vec3;
  humanRotation: number;
  entry: Vec3;
  floorAreas: readonly Rect[];
  restSeats: readonly { id: string; position: Vec3; approach: Vec3; rotation: number }[];
  walkGraph: {
    nodes: readonly Vec3[];
    edges: readonly (readonly [number, number])[];
  };
};
export { BOTANICAL_LAYOUT as OFFICE_LAYOUT } from "./styles/botanical/layout";
