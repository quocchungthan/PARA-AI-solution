import { sessionActorId } from "../runtime";
import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import type { SharedOfficeEvent } from "../types";
export function Handoffs({
  events,
  anchors,
  reducedMotion,
  budget,
}: {
  events: readonly SharedOfficeEvent[];
  anchors: MutableRefObject<Map<string, Group>>;
  reducedMotion: boolean;
  budget: number;
}) {
  if (reducedMotion) return null;
  return (
    <>
      {events
        .filter(
          (e) => e.startedAt !== undefined && e.originId && e.kind !== "arrive",
        )
        .slice(0, budget)
        .map((e) => (
          <Card key={e.id} event={e} anchors={anchors} />
        ))}
    </>
  );
}
function Card({
  event,
  anchors,
}: {
  event: SharedOfficeEvent;
  anchors: MutableRefObject<Map<string, Group>>;
}) {
  const card = useRef<Group>(null),
    a = useRef(new Vector3()),
    b = useRef(new Vector3());
  useFrame(() => {
    const origin = anchors.current.get(sessionActorId(event.originId!)),
      target = anchors.current.get(sessionActorId(event.sessionId));
    if (!origin || !target) {
      if (card.current) card.current.visible = false;
      return;
    }
    a.current.copy(event.kind === "report" ? target.position : origin.position);
    b.current.copy(event.kind === "report" ? origin.position : target.position);
    const t = Math.max(0, Math.min(1, (Date.now() - event.startedAt!) / 1500));
    if (card.current) {
      card.current.visible = true;
      card.current.position.lerpVectors(a.current, b.current, t);
      card.current.position.y += 2 + Math.sin(t * Math.PI) * 1.7;
      card.current.rotation.y = t * Math.PI;
    }
  });
  return (
    <group ref={card}>
      <mesh>
        <boxGeometry args={[0.4, 0.3, 0.08]} />
        <meshStandardMaterial
          color="#f3d993"
          emissive="#e0ac4c"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
