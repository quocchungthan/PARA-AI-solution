import { useMemo, useRef, useLayoutEffect, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { OfficeCanvasProps } from "./OfficeCanvas";
import { Character, type CharacterKind } from "./Character";
import { OFFICE_LAYOUT as l } from "../layout";
import { OFFICE_ROLES, ROLE_NAMES, officeRole } from "../roles";
import { presentSession, sessionTitle } from "../model";
import type { OfficeRole, OfficeSelection, Vec3, WorkerSlot } from "../types";
import { findRoute, workerPath } from "../routes";
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
  selection: OfficeSelection;
  identitySeed: string;
  worker?: WorkerSlot;
  rest?: "lounge" | "desk";
};
export function describeActors(props: OfficeCanvasProps): ActorDescriptor[] {
  const floorId = props.floor.rootId;
  const root = props.model.sessionsById.get(floorId)!;
  const rootStatus = presentSession(root);
  const actors: ActorDescriptor[] = [
    {
      id: "human",
      label: "You · manager",
      kind: "human",
      role: "coordinator",
      position: l.human,
      rotation: Math.PI,
      status: "human",
      health: false,
      selection: { kind: "human", floorId },
      identitySeed: "human",
    },
    {
      id: "assistant",
      label: "Executive assistant",
      kind: "assistant",
      role: "coordinator",
      position: l.leads.coordinator,
      rotation: Math.PI,
      status: rootStatus.needsHuman ? "needs-human" : rootStatus.activity,
      health: !!rootStatus.healthIssues.length,
      selection: { kind: "session", floorId, sessionId: floorId },
      identitySeed: "lead-coordinator",
    },
  ];
  let loungeIndex = 0;
  for (const role of OFFICE_ROLES.filter(
    (r) => r !== "coordinator" && r !== "unknown",
  )) {
    const d = props.floor.departments.find((d) => d.role === role)!;
    const live = d.sessionIds
      .map((id) => props.model.sessionsById.get(id)!)
      .filter((s) => s.state !== "done");
    const seat = l.seats.find((s) => s.reservedFor === role)!;
    const idle = live.length === 0 && d.healthIssues === 0;
    const lounge =
      idle && loungeIndex < l.lounge.length ? l.lounge[loungeIndex++] : null;
    actors.push({
      id: `lead-${role}`,
      label: `${ROLE_NAMES[role]} lead`,
      kind: "lead",
      role,
      position: lounge ?? l.leads[role],
      rotation: lounge ? 0 : seat.rotation,
      status: d.needsHuman
        ? "needs-human"
        : d.working
          ? "working"
          : live.length
            ? "waiting"
            : "idle",
      health: d.healthIssues > 0,
      selection: { kind: "department", floorId, role },
      identitySeed: `lead-${role}`,
      rest: idle ? (lounge ? "lounge" : "desk") : undefined,
    });
  }
  for (const worker of props.floorRuntime.workers) {
    const s = props.model.sessionsById.get(worker.sessionId);
    if (!s) continue;
    const p = presentSession(s),
      seat = l.seats.find((s) => s.id === worker.seatId)!;
    actors.push({
      id: worker.sessionId,
      label: sessionTitle(s),
      kind: "worker",
      role: officeRole(s.agent),
      position: seat.position,
      rotation: seat.rotation,
      status: p.needsHuman ? "needs-human" : p.activity,
      health: !!p.healthIssues.length,
      selection: { kind: "session", floorId, sessionId: s.sessionId },
      identitySeed: worker.identitySeed,
      worker,
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
  const group = useRef<Group>(null);
  const initial = useRef(a.position);
  const visit = useRef<{ path: readonly Vec3[]; started: number } | null>(null);
  const target = useRef(a.position);
  const path = useMemo(
    () =>
      a.worker
        ? workerPath(
            l,
            a.worker,
            props.model,
            props.floor.rootId,
            props.floorRuntime.workers,
          )
        : [a.position],
    [
      a.worker?.phase,
      a.worker?.seatId,
      a.worker?.phaseStartedAt,
      props.model,
      props.floor.rootId,
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
    if (props.reducedMotion) group.current!.position.set(...a.position);
  }, [a.position, props.reducedMotion]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const worker = a.worker;
    const moving =
      worker && (worker.phase === "entering" || worker.phase === "leaving");
    if (moving) {
      const sampled = samplePath(
        path,
        Date.now() - worker.phaseStartedAt,
        2.2,
        props.reducedMotion,
      );
      g.position.set(...sampled.position);
      g.rotation.y = sampled.done ? a.rotation : sampled.heading;
    } else if (visit.current) {
      const sampled = samplePath(
        visit.current.path,
        Date.now() - visit.current.started,
        2.2,
        props.reducedMotion,
      );
      g.position.set(...sampled.position);
      g.rotation.y = sampled.done ? a.rotation : sampled.heading;
      if (sampled.done) visit.current = null;
    } else {
      g.position.set(...a.position);
      g.rotation.y = a.rotation;
    }
  });
  const moving =
    !!a.worker &&
    ["entering", "leaving"].includes(a.worker.phase) &&
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
        onSelect={() => onSelect(a.selection)}
      />
    </group>
  );
}
