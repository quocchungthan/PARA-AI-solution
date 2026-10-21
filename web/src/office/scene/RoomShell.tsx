import { useMemo } from "react";
import type { OfficeLayout } from "../layout";
import type { BotanicalPalette } from "./palette";
import { box, VoxelBatch, type Voxel } from "./resources";
export function RoomShell({
  layout,
  p,
  cutaway=true,
}: {
  layout: OfficeLayout;
  p: BotanicalPalette;
  cutaway?: boolean;
}) {
  const voxels = useMemo(() => {
    const v: Voxel[] = [];
    box(v, [0, -0.35, 0], [30.4, 0.65, 20.4], p.wood);
    box(v, [0, -0.02, 0], [30, 0.1, 20], p.floor);
    for (let x = -14.5; x < 15; x++)
      for (let z = -9.5; z < 10; z++)
        box(
          v,
          [x, 0.045, z],
          [0.97, 0.035, 0.97],
          Math.round(x + z) % 3 === 0 ? p.tile : p.floor,
        );
    for (const room of layout.rooms.filter((r) => r.id !== "team")) {
      box(
        v,
        [room.x + room.width / 2, 0.07, room.z + room.depth / 2],
        [room.width - 0.65, 0.035, room.depth - 0.65],
        room.id === "pantry" ? p.tile : p.floor,
      );
    }
    for (const w of layout.walls) {
      const h = cutaway ? w.cutawayHeight : w.height;
      box(
        v,
        [(w.from[0] + w.to[0]) / 2, h / 2, (w.from[2] + w.to[2]) / 2],
        [
          Math.max(0.2, Math.abs(w.to[0] - w.from[0])),
          h,
          Math.max(0.2, Math.abs(w.to[2] - w.from[2])),
        ],
        p.walls,
      );
      box(
        v,
        [(w.from[0] + w.to[0]) / 2, h + 0.04, (w.from[2] + w.to[2]) / 2],
        [
          Math.max(0.25, Math.abs(w.to[0] - w.from[0])),
          0.1,
          Math.max(0.25, Math.abs(w.to[2] - w.from[2])),
        ],
        p.trim,
      );
    }
    for (const door of layout.doors) {
      for (const dx of [-1.08, 1.08])
        box(v, [door[0] + dx, 1.35, door[2]], [0.16, 2.7, 0.26], p.woodLight);
      box(v, [door[0], 0.09, door[2]], [2, 0.06, 0.7], p.wood);
    }
    for (const x of [-13.3, -8, -0.1, 7, 14]) {
      box(v, [x, 1.9, -9.78], [0.22, 3.8, 0.3], p.wood);
    }
    // Framed botanical art and the planning board are actual scene geometry.
    for (const x of [-11, -4.5, 3.5, 11]) {
      box(v, [x, 2.65, -9.72], [2.6, 1.65, 0.16], p.woodLight);
      box(v, [x, 2.65, -9.6], [2.35, 1.4, 0.08], p.paper);
      for (let i = 0; i < 5; i++)
        box(
          v,
          [x - 0.8 + (i % 3) * 0.65, 2.35 + Math.floor(i / 3) * 0.6, -9.53],
          [0.42, 0.36, 0.06],
          i % 2 ? p.fabric : p.wood,
        );
    }
    return v;
  }, [layout, p, cutaway]);
  return <VoxelBatch voxels={voxels} />;
}
