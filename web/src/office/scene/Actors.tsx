import { useMemo, useRef, useLayoutEffect, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { OfficeCanvasProps } from "./OfficeCanvas";
import { Character, type CharacterKind } from "./Character";

import { OFFICE_ROLES, ROLE_NAMES, officeRole } from "../roles";
import { presentSession, sessionTitle } from "../model";
import type { OfficeRole, SharedOfficeSelection, Vec3, WorkerSlot } from "../types";
import { findRoute, sharedWorkerPath } from "../routes";
import { sessionActorId } from "../runtime";
import { samplePath } from "./motion";
export type ActorDescriptor = {
  id: string;
  label: string;
  kind: CharacterKind;
  role: OfficeRole;
  position: Vec3;
  rotation: number;
  status: string;
  health: boolean;
  selection: SharedOfficeSelection;
  identitySeed: string;
  worker?: WorkerSlot;
  rest?: "lounge" | "desk";
};
export function describeActors(props: OfficeCanvasProps): ActorDescriptor[] {
  const l=props.style.layout;
  const actors: ActorDescriptor[] = [{
    id: "human", label: "You · manager", kind: "human", role: "coordinator",
    position: l.human, rotation: l.humanRotation, status: "human", health: false,
    selection: { kind: "human" }, identitySeed: "human",
  }];
  let loungeIndex = 0;
  for (const role of OFFICE_ROLES.filter(r => r !== "unknown")) {
    const d = props.model.departments.find(d => d.agent === role)!;
    const seat = l.seats.find(s => s.reservedFor === role);
    const idle = d.unfinished === 0;
    const lounge = props.style.id === "botanical" && idle && loungeIndex < l.restSeats.length ? l.restSeats[loungeIndex++] : null;
    actors.push({
      id: role === "coordinator" ? "assistant" : `lead-${role}`,
      label: role === "coordinator" ? "Executive assistant" : `${ROLE_NAMES[role]} lead`,
      kind: role === "coordinator" ? "assistant" : "lead", role,
      position: lounge?.position ?? l.leads[role], rotation: lounge ? lounge.rotation : seat?.rotation ?? Math.PI,
      status: d.activity, health: d.healthIssues > 0,
      selection: { kind: "department", agent: role }, identitySeed: `lead-${role}`,
      rest: idle ? (lounge ? "lounge" : "desk") : undefined,
    });
  }
  for (const worker of props.runtime.workers) {
    const s = props.model.sessionsById.get(worker.sessionId);
    if (!s) continue;
    const p = presentSession(s), seat = l.seats.find(s => s.id === worker.seatId)!;
    actors.push({
      id: sessionActorId(s.sessionId), label: sessionTitle(s), kind: "worker", role: officeRole(s.agent),
      position: seat.position, rotation: seat.rotation, status: p.needsHuman ? "needs-human" : p.activity,
      health: !!p.healthIssues.length, selection: { kind: "session", sessionId: s.sessionId },
      identitySeed: worker.identitySeed, worker,
    });
  }
  return actors;
}
export function Actors({
  actors,
  registry,
  onSelect,
  props,
}: {
  actors: readonly ActorDescriptor[];
  registry: MutableRefObject<Map<string, Group>>;
  onSelect: OfficeCanvasProps["onSelect"];
  props: OfficeCanvasProps;
}) {
  return (
    <>
      {actors.map((a) => (
        <Actor
          key={a.id}
          actor={a}
          registry={registry}
          onSelect={onSelect}
          props={props}
        />
      ))}
    </>
  );
}
function Actor({
  actor: a,
  registry,
  onSelect,
  props,
}: {
  actor: ActorDescriptor;
  registry: MutableRefObject<Map<string, Group>>;
  onSelect: OfficeCanvasProps["onSelect"];
  props: OfficeCanvasProps;
}) {
  const l=props.style.layout;
  const group = useRef<Group>(null);
  const initial = useRef(a.position);
  const visit = useRef<{ path: readonly Vec3[]; started: number } | null>(null);
  const target = useRef(a.position);
  const walking = useRef(false);
  const [visiting, setVisiting] = useState(false);
  const path = useMemo(
    () =>
      a.worker
        ? sharedWorkerPath(
          l,
          a.worker,
          props.model,
          props.runtime.workers,
        )
        : [a.position],
    [
      l,
      a.worker?.phase,
      a.worker?.seatId,
      a.worker?.phaseStartedAt,
      props.model,
      props.runtime.workers,
    ],
  );
  useLayoutEffect(() => {
    const g = group.current!;
    g.position.set(...initial.current);
    registry.current.set(a.id, g);
    return () => {
      registry.current.delete(a.id);
    };
  }, [a.id, registry]);
  useLayoutEffect(() => {
    if (a.worker || target.current.join() === a.position.join()) return;
    const from: Vec3 = [
      group.current!.position.x,
      0,
      group.current!.position.z,
    ];
    target.current = a.position;
    visit.current = props.reducedMotion
      ? null
      : { path: findRoute(l, from, a.position), started: Date.now() };
    setVisiting(!!visit.current);
    if (props.reducedMotion) group.current!.position.set(...a.position);
  }, [a.position, props.reducedMotion]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const worker = a.worker;
    const moving =
      worker && (worker.phase === "entering" || worker.phase === "leaving");
    walking.current = false;
    if (moving) {
      const sampled = samplePath(
        path,
        Date.now() - worker.phaseStartedAt,
        2.2,
        props.reducedMotion,
      );
      g.position.set(...sampled.position);
      g.rotation.y = sampled.done ? a.rotation : sampled.heading;
      walking.current = !sampled.done && !props.reducedMotion;
    } else if (visit.current) {
      const sampled = samplePath(
        visit.current.path,
        Date.now() - visit.current.started,
        2.2,
        props.reducedMotion,
      );
      g.position.set(...sampled.position);
      g.rotation.y = sampled.done ? a.rotation : sampled.heading;
      walking.current = !sampled.done && !props.reducedMotion;
      if (sampled.done) {
        visit.current = null;
        setVisiting(false);
      }
    } else {
      g.position.set(...a.position);
      g.rotation.y = a.rotation;
    }
  });
  const moving =
    (visiting || (!!a.worker && ["entering", "leaving"].includes(a.worker.phase))) &&
    !props.reducedMotion;
  return (
    <group ref={group}>
      <Character
        identitySeed={a.identitySeed}
        role={a.role}
        kind={a.kind}
        pose={moving ? "standing" : "seated"}
        activity={a.status}
        reducedMotion={props.reducedMotion}
        rest={!!a.rest}
        walking={walking}
        onSelect={() => onSelect(a.selection)}
      />
    </group>
  );
}
