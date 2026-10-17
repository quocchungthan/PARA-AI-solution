import { useMemo } from "react";
import type { OfficeLayout } from "../layout";
import type { BotanicalPalette } from "./palette";
import { box, VoxelBatch, type Voxel } from "./resources";
export function Furniture({
  layout,
  p,
}: {
  layout: OfficeLayout;
  p: BotanicalPalette;
}) {
  const voxels = useMemo(() => {
    const v: Voxel[] = [];
    for (const desk of layout.desks) {
      const x = desk.x + desk.width / 2,
        z = desk.z + desk.depth / 2;
      box(v, [x, 1.18, z], [desk.width, 0.2, desk.depth], p.woodLight);
      for (const dx of [-1, 1])
        for (const dz of [-1, 1])
          box(
            v,
            [
              x + dx * (desk.width / 2 - 0.18),
              0.6,
              z + dz * (desk.depth / 2 - 0.18),
            ],
            [0.15, 1.2, 0.15],
            p.wood,
          );
      box(v, [x, 0.75, z], [desk.width - 0.4, 0.45, 0.5], p.wood);
    }
    function station(x: number, z: number, face: number) {
      box(v, [x, 1.7, z], [1.04, 0.68, 0.11], p.ink);
      box(v, [x, 1.72, z + face * 0.065], [0.91, 0.53, 0.025], p.screen);
      for (let k = 0; k < 3; k++)
        box(
          v,
          [x - 0.25, 1.84 - k * 0.13, z + face * 0.082],
          [0.32 + k * 0.08, 0.025, 0.016],
          p.paper,
        );
      box(v, [x, 1.36, z], [0.1, 0.28, 0.12], p.ink);
      box(v, [x, 1.28, z], [0.44, 0.045, 0.32], p.ink);
      box(v, [x, 1.31, z + face * 0.52], [0.8, 0.05, 0.28], p.paper);
      box(v, [x + 0.65, 1.32, z + face * 0.4], [0.15, 0.08, 0.2], p.fabricDark);
    }
    for (const seat of layout.seats) {
      const [x, , z] = seat.position;
      const face = seat.rotation === 0 ? 1 : -1;
      box(v, [x, 0.68, z], [0.85, 0.15, 0.8], p.fabric);
      box(v, [x, 1.08, z - face * 0.36], [0.85, 0.78, 0.16], p.fabricDark);
      box(v, [x, 0.34, z], [0.13, 0.6, 0.13], p.ink);
      box(v, [x, 0.16, z], [0.8, 0.08, 0.12], p.ink);
      box(v, [x, 0.16, z], [0.12, 0.08, 0.75], p.ink);
      station(x, z + face * 1.45, -face);
    }
    station(-5, -7.45, 1);
    station(-1.8, -5.85, 1);
    // Library shelves, colored spines, storage and task lamps.
    for (const x of [-13.6, -10, -6.8, 8.1, 13.7]) {
      box(v, [x, 1.4, -9.25], [1.3, 2.7, 0.6], p.wood);
      for (let row = 0; row < 3; row++) {
        box(v, [x, 0.55 + row * 0.8, -8.89], [1.14, 0.64, 0.15], p.ink);
        for (let k = 0; k < 5; k++)
          box(
            v,
            [x - 0.45 + k * 0.22, 0.55 + row * 0.8, -8.78],
            [0.16, 0.46 + (k % 2) * 0.13, 0.28],
            [p.fabric, p.paper, p.woodLight, p.trim][k % 4],
          );
      }
    }
    // Creative meeting table and stools.
    for (const [x, z] of [
      [1.3, -7],
      [5.7, -7],
      [3.5, -4.8],
    ]) {
      box(v, [x, 0.65, z], [0.9, 0.17, 0.9], p.fabric);
      box(v, [x, 0.32, z], [0.18, 0.6, 0.18], p.wood);
    }
    // Kitchen: cabinets, counter, sink, coffee machine, fridge.
    box(v, [14, 0.65, 1], [1.25, 1.3, 4.7], p.wood);
    box(v, [14, 1.34, 1], [1.4, 0.14, 4.8], p.paper);
    for (const z of [-0.5, 0.7, 1.9])
      box(v, [13.35, 0.75, z], [0.04, 0.08, 0.55], p.fabricDark);
    box(v, [14, 1.43, 1.3], [0.85, 0.04, 0.8], p.ink);
    box(v, [14.3, 1.62, 1.3], [0.08, 0.42, 0.08], p.woodLight);
    box(v, [14, 1.75, -0.6], [0.6, 0.75, 0.6], p.ink);
    box(v, [13.75, 1.75, -0.6], [0.09, 0.4, 0.4], p.woodLight);
    box(v, [14.1, 1.2, -2], [1.35, 2.4, 1.1], p.paper);
    box(v, [13.4, 1.6, -2], [0.08, 0.45, 0.08], p.ink);
    // Lounge aligned with its reserved idle anchors.
    const lounge = layout.loungeFurniture;
    const furnishing = (
      r: typeof lounge.sofa,
      y: number,
      height: number,
      color: string,
    ) =>
      box(
        v,
        [r.x + r.width / 2, y, r.z + r.depth / 2],
        [r.width, height, r.depth],
        color,
      );
    furnishing(lounge.sofa, 0.5, 0.65, p.fabricDark);
    furnishing(lounge.backrest, 1.05, 1.25, p.fabric);
    for (const arm of lounge.arms) furnishing(arm, 0.85, 0.8, p.fabric);
    for (const [x, , z] of layout.lounge)
      box(v, [x, 0.88, z + 0.05], [1.3, 0.22, 1.12], p.fabric);
    furnishing(lounge.table, 0.7, 0.15, p.woodLight);
    for (const x of [11.4, 13.1])
      box(v, [x, 0.34, 8.4], [0.14, 0.65, 0.7], p.wood);
    for (const [x, z] of [
      [-14, -4],
      [-7.5, -8.8],
      [8, -4],
    ]) {
      box(v, [x, 1, z], [0.1, 2, 0.1], p.wood);
      box(v, [x, 2.05, z], [0.65, 0.5, 0.65], p.paper);
      box(v, [x, 0.1, z], [0.5, 0.16, 0.5], p.ink);
    }
    return v;
  }, [layout, p]);
  return <VoxelBatch voxels={voxels} />;
}
