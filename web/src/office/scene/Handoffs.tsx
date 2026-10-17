import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import type { OfficeEvent } from "../types";
export function Handoffs({
  events,
  anchors,
  rootId,
  reducedMotion,
  budget,
}: {
  events: readonly OfficeEvent[];
  anchors: MutableRefObject<Map<string, Group>>;
  rootId: string;
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
          <Card key={e.id} event={e} anchors={anchors} rootId={rootId} />
        ))}
    </>
  );
}
function Card({
  event,
  anchors,
  rootId,
}: {
  event: OfficeEvent;
  anchors: MutableRefObject<Map<string, Group>>;
  rootId: string;
}) {
  const card = useRef<Group>(null),
    a = useRef(new Vector3()),
    b = useRef(new Vector3());
  useFrame(() => {
    const origin = anchors.current.get(
        event.originId === rootId ? "assistant" : event.originId!,
      ),
      target = anchors.current.get(
        event.sessionId === rootId ? "assistant" : event.sessionId,
      );
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
