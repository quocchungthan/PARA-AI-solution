import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  MeshLambertMaterial,
  Color,
  InstancedMesh,
  Object3D,
  Matrix4,
  DynamicDrawUsage,
  Sphere,
  Vector3,
} from "three";
import type { Vec3 } from "../types";
export type Voxel = {
  position: Vec3;
  size: Vec3;
  color: string;
  rotation?: number;
};
type Resources = { box: BoxGeometry; material: MeshLambertMaterial };
const resourceContext = createContext<Resources | null>(null);
export function SceneResources({ children }: { children: ReactNode }) {
  const resources = useMemo(
    () => ({ box: new BoxGeometry(), material: new MeshLambertMaterial() }),
    [],
  );
  useEffect(
    () => () => {
      resources.box.dispose();
      resources.material.dispose();
    },
    [resources],
  );
  return (
    <resourceContext.Provider value={resources}>
      {children}
    </resourceContext.Provider>
  );
}
export type RigPart = {
  voxels: readonly Voxel[];
  pivot: Vec3;
  axis: "x" | "y" | "none";
};
export function RiggedBatch({
  parts,
  angles,
}: {
  parts: readonly RigPart[];
  angles: RefObject<readonly number[]>;
}) {
  const mesh = useRef<InstancedMesh>(null),
    resources = useContext(resourceContext);
  if (!resources) throw new Error("Missing scene resources");
  const prepared = useMemo(() => {
    const object = new Object3D();
    return parts.map((part) => ({
      bone: new Object3D(),
      axis: part.axis,
      pivot: part.pivot,
      voxels: part.voxels.map((v) => {
        object.position.set(...v.position);
        object.scale.set(...v.size);
        object.rotation.set(0, v.rotation ?? 0, 0);
        object.updateMatrix();
        return { matrix: object.matrix.clone(), color: v.color };
      }),
    }));
  }, [parts]);
  const matrix = useMemo(() => new Matrix4(), []),
    color = useMemo(() => new Color(), []),
    last = useRef<number[]>([]);
  function update(force = false) {
    const target = mesh.current;
    if (!target) return;
    let index = 0,
      changed = false;
    prepared.forEach((part, boneIndex) => {
      const angle = angles.current[boneIndex] ?? 0;
      const dirty = force || last.current[boneIndex] !== angle;
      if (dirty) {
        part.bone.position.set(...part.pivot);
        part.bone.rotation.set(
          part.axis === "x" ? angle : 0,
          part.axis === "y" ? angle : 0,
          0,
        );
        part.bone.updateMatrix();
        last.current[boneIndex] = angle;
        changed = true;
      }
      for (const voxel of part.voxels) {
        if (dirty) {
          matrix.multiplyMatrices(part.bone.matrix, voxel.matrix);
          target.setMatrixAt(index, matrix);
          if (force) target.setColorAt(index, color.set(voxel.color));
        }
        index++;
      }
    });
    if (changed) target.instanceMatrix.needsUpdate = true;
    if (force && target.instanceColor) target.instanceColor.needsUpdate = true;
  }
  useLayoutEffect(() => {
    mesh.current!.instanceMatrix.setUsage(DynamicDrawUsage);
    last.current = [];
    update(true);
    mesh.current!.boundingSphere = new Sphere(new Vector3(0, 1.2, 0), 1.9);
  }, [prepared]);
  useFrame(() => update());
  return (
    <instancedMesh
      ref={mesh}
      args={[
        resources.box,
        resources.material,
        prepared.reduce((n, p) => n + p.voxels.length, 0),
      ]}
      receiveShadow
    />
  );
}
export const box = (
  list: Voxel[],
  position: Vec3,
  size: Vec3,
  color: string,
  rotation = 0,
) => list.push({ position, size, color, rotation });
// Low-frequency renderer diagnostics used by the verification harness; no global state or polling.
export function SceneMetrics({styleId='botanical',label='Botanical Studio'}:{styleId?:string;label?:string}) {
  const {gl}=useThree();
  useEffect(()=>{gl.domElement.setAttribute('aria-label',`${label} office scene`);gl.domElement.dataset.style=styleId;},[gl,label,styleId]);
  const last = useRef(0);
  useFrame(({ gl, clock }) => {
    if (clock.elapsedTime - last.current < 1) return;
    last.current = clock.elapsedTime;
    const data = gl.domElement.dataset;
    data.drawCalls = String(gl.info.render.calls);
    data.triangles = String(gl.info.render.triangles);
    data.geometries = String(gl.info.memory.geometries);
    data.textures = String(gl.info.memory.textures);
    data.renderDpr = String(gl.getPixelRatio());
  });
  return null;
}
export function VoxelBatch({
  voxels,
  shadow = true,
}: {
  voxels: readonly Voxel[];
  shadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const resources = useContext(resourceContext);
  if (!resources)
    throw new Error("Voxel batches require scene-owned shared resources");
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
      args={[resources.box, resources.material, voxels.length]}
      castShadow={shadow}
      receiveShadow
    />
  );
}
