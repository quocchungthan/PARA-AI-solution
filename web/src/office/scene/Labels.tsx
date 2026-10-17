import { useMemo, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import type { Vec3 } from "../types";
export type LabelAnchor = {
  id: string;
  position: Vec3;
  actorId?: string;
  roomId?: string;
};
export function Labels({
  anchors,
  registry,
  elements,
}: {
  anchors: readonly LabelAnchor[];
  registry: MutableRefObject<Map<string, Group>>;
  elements: MutableRefObject<Map<string, HTMLButtonElement>>;
}) {
  const vector = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = elements.current.get(a.id);
      if (!el) continue;
      const group = a.actorId ? registry.current.get(a.actorId) : null;
      if (group) {
        vector.copy(group.position);
        vector.y += 2.6;
      } else vector.set(...a.position);
      vector.project(camera);
      const visible =
        Math.abs(vector.x) < 1 &&
        Math.abs(vector.y) < 0.96 &&
        vector.z > -1 &&
        vector.z < 1;
      el.style.visibility = visible ? "visible" : "hidden";
      el.style.transform = `translate(-50%,-100%) translate(${((vector.x + 1) * size.width) / 2}px,${((1 - vector.y) * size.height) / 2}px)`;
    }
  });
  return null;
}
