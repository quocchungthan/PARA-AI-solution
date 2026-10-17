import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { sampleWorkPose } from "./motion";
import type { OfficeRole } from "../types";
import { box, VoxelBatch, type Voxel } from "./resources";
export type CharacterKind = "human" | "assistant" | "lead" | "worker";
export const identityHash = (seed: string) =>
  [...seed].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
export function Character({
  identitySeed,
  role,
  kind,
  pose,
  onSelect,
  activity = "waiting",
  reducedMotion = false,
  rest = false,
}: {
  identitySeed: string;
  role: OfficeRole;
  kind: CharacterKind;
  pose: "seated" | "standing";
  onSelect: () => void;
  activity?: string;
  reducedMotion?: boolean;
  rest?: boolean;
}) {
  const head = useRef<Group>(null),
    left = useRef<Group>(null),
    right = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1000;
    const moving = pose === "standing";
    const animate = !reducedMotion && kind !== "human";
    const work =
      animate && activity === "working" && !moving
        ? sampleWorkPose(role, t)
        : { head: 0, leftArm: 0, rightArm: 0 };
    if (head.current) head.current.rotation.y = work.head;
    if (left.current)
      left.current.rotation.x =
        work.leftArm +
        (animate && moving
          ? Math.sin(t * 0.008) * 0.15
          : animate && rest
            ? -0.25 + Math.sin(t * 0.001) * 0.05
            : 0);
    if (right.current)
      right.current.rotation.x =
        work.rightArm + (animate && moving ? -Math.sin(t * 0.008) * 0.15 : 0);
  });
  const voxels = useMemo(() => {
    const v: Voxel[] = [];
    const n = identityHash(identitySeed),
      skin = ["#dfac7f", "#c89363", "#9c6646", "#f1cba7"][n % 4],
      hair = ["#302c24", "#68482b", "#c8984f", "#71432d"][n % 4];
    const outfit: Record<OfficeRole, string> = {
      coordinator: "#356e64",
      researcher: "#d0bea0",
      coder: "#477aa0",
      reviewer: "#d5aa4c",
      "functional-reviewer": "#af7054",
      hr: "#b9c7ab",
      "scrum-master": "#6d925d",
      unknown: "#8d9294",
    };
    const shirt = kind === "human" ? "#354f68" : outfit[role];
    box(v, [0, 1.12, 0], [0.68, 0.68, 0.4], shirt);
    box(v, [0, 1.53, 0.02], [0.2, 0.16, 0.2], skin);
    box(v, [0, 1.88, 0], [0.66, 0.62, 0.6], skin);
    box(v, [0, 2.23, -0.03], [0.72, 0.18, 0.65], hair);
    box(v, [-0.29, 2.03, -0.12], [0.15, 0.3, 0.46], hair);
    box(v, [0.27, 2.1, -0.12], [0.15, 0.24, 0.46], hair);
    box(v, [0, 2.13, -0.31], [0.64, 0.3, 0.12], hair);
    box(v, [-0.17, 2.3, -0.1], [0.32, 0.12, 0.4], hair);
    for (const x of [-0.14, 0.14])
      box(v, [x, 1.93, 0.307], [0.065, 0.075, 0.025], "#292d28");
    box(v, [0, 1.81, 0.33], [0.1, 0.1, 0.07], skin);
    box(v, [0, 1.72, 0.309], [0.16, 0.035, 0.02], "#775541");
    if (role === "reviewer" || role === "researcher") {
      for (const x of [-0.16, 0.16]) {
        box(v, [x, 1.93, 0.329], [0.23, 0.17, 0.035], "#394437");
        box(v, [x, 1.94, 0.351], [0.15, 0.1, 0.02], skin);
      }
      box(v, [0, 1.94, 0.34], [0.1, 0.04, 0.02], "#394437");
    }
    if (kind === "assistant")
      box(v, [0, 1.26, 0.22], [0.07, 0.34, 0.05], "#e6d3a3");
    if (kind === "lead")
      box(v, [0.2, 1.35, 0.22], [0.1, 0.13, 0.025], "#d8e3ce");
    for (const x of [-0.22, 0.22]) {
      box(
        v,
        [x, 0.75, pose === "seated" ? 0.21 : 0],
        [0.24, 0.23, pose === "seated" ? 0.65 : 0.25],
        "#37463f",
      );
      box(
        v,
        [x, pose === "seated" ? 0.4 : 0.43, pose === "seated" ? 0.4 : 0],
        [0.22, pose === "seated" ? 0.6 : 0.67, 0.23],
        "#37463f",
      );
      box(
        v,
        [x, 0.14, pose === "seated" ? 0.48 : 0.08],
        [0.27, 0.18, 0.38],
        "#293832",
      );
    }
    for (const x of [-0.44, 0.44]) {
      box(v, [x, 1.19, 0.04], [0.2, 0.43, 0.23], shirt);
      box(v, [x, 1.01, 0.27], [0.2, 0.19, 0.43], shirt);
      box(v, [x, 1.02, 0.52], [0.19, 0.16, 0.18], skin);
    }
    if (rest) {
      box(v, [0.44, 1.17, 0.57], [0.2, 0.23, 0.2], "#e5dfc3");
      box(v, [0.44, 1.3, 0.57], [0.16, 0.025, 0.16], "#54402b");
    }
    const head = v
      .filter((p) => p.position[1] > 1.55)
      .map((p) => ({
        ...p,
        position: [p.position[0], p.position[1] - 1.7, p.position[2]] as const,
      }));
    const arm = (side: number) =>
      v
        .filter((p) => p.position[1] <= 1.55 && p.position[0] === side)
        .map((p) => ({
          ...p,
          position: [
            p.position[0] - side,
            p.position[1] - 1.4,
            p.position[2],
          ] as const,
        }));
    return {
      body: v.filter(
        (p) => p.position[1] <= 1.55 && Math.abs(p.position[0]) !== 0.44,
      ),
      head,
      left: arm(-0.44),
      right: arm(0.44),
    };
  }, [identitySeed, role, kind, pose, rest]);
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta <= 4) onSelect();
      }}
    >
      <VoxelBatch voxels={voxels.body} />
      <group ref={head} position={[0, 1.7, 0]}>
        <VoxelBatch voxels={voxels.head} />
      </group>
      <group ref={left} position={[-0.44, 1.4, 0]}>
        <VoxelBatch voxels={voxels.left} />
      </group>
      <group ref={right} position={[0.44, 1.4, 0]}>
        <VoxelBatch voxels={voxels.right} />
      </group>
    </group>
  );
}
