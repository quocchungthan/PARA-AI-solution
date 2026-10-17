import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
import type { Vec3 } from "../types";
export type Voxel = {
  position: Vec3;
  size: Vec3;
  color: string;
  rotation?: number;
};
export const box = (
  list: Voxel[],
  position: Vec3,
  size: Vec3,
  color: string,
  rotation = 0,
) => list.push({ position, size, color, rotation });
export function VoxelBatch({
  voxels,
  shadow = true,
}: {
  voxels: readonly Voxel[];
  shadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    voxels.forEach((v, i) => {
      dummy.position.set(...v.position);
      dummy.scale.set(...v.size);
      dummy.rotation.set(0, v.rotation ?? 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(v.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [voxels, dummy, color]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, voxels.length]}
      castShadow={shadow}
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial roughness={0.84} />
    </instancedMesh>
  );
}
