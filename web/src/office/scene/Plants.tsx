import { useMemo } from "react";
import type { BotanicalPalette } from "./palette";
import { box, VoxelBatch, type Voxel } from "./resources";
export function Plants({ p }: { p: BotanicalPalette }) {
  const voxels = useMemo(() => {
    const v: Voxel[] = [];
    function plant(x: number, z: number, y = 0, scale = 1) {
      box(
        v,
        [x, y + 0.27 * scale, z],
        [0.5 * scale, 0.55 * scale, 0.5 * scale],
        p.pot,
      );
      box(
        v,
        [x, y + 0.58 * scale, z],
        [0.45 * scale, 0.1 * scale, 0.45 * scale],
        p.ink,
      );
      box(
        v,
        [x, y + 1.15 * scale, z],
        [0.1 * scale, 1.2 * scale, 0.1 * scale],
        p.wood,
      );
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        box(
          v,
          [
            x + Math.sin(a) * 0.28 * scale,
            y + (0.85 + i * 0.15) * scale,
            z + Math.cos(a) * 0.24 * scale,
          ],
          [0.36 * scale, 0.42 * scale, 0.32 * scale],
          i % 2 ? p.leafLight : p.leaves,
        );
      }
    }
    for (const [x, z] of [
      [-14, -9],
      [-8.7, -9],
      [-7.3, -3.6],
      [-0.7, -9],
      [0.7, -3.6],
      [6.3, -9],
      [7.7, -3.6],
      [14, -9],
      [-14, 1],
      [-14, 7],
      [9, 4],
      [14, 9],
      [-11, 9],
      [-4, 9],
    ])
      plant(x, z);
    for (const [x, z] of [
      [-7, 1],
      [3, 1],
      [-7, 6],
      [3, 6],
      [-5, -7.3],
      [10.5, -7.6],
      [3.5, -7],
      [-12, -7.5],
    ])
      plant(x, z, 1.3, 0.4);
    for (const x of [-13, -10, -7, -4, -1, 2, 5, 8]) plant(x, 9.55, 0.5, 0.5);
    return v;
  }, [p]);
  return <VoxelBatch voxels={voxels} shadow={false} />;
}
