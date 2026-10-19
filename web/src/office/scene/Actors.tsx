import { useMemo, useRef, useEffect, useLayoutEffect, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {AnimationDriver} from './AnimationDriver';
import {planAmbientVisit,retainAmbientVisit,type AmbientVisit} from './ambient';
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
  const {gl}=useThree();
  const [ambient,setAmbient]=useState<AmbientVisit|null>(null),[wake,setWake]=useState(0);
  const cycle=useRef(0),nextVisit=useRef(Date.now()+20007);
  const layout=props.style.layout;
  const ambientActors=actors.map(a=>({...a,selected:JSON.stringify(a.selection)===JSON.stringify(props.selection)}));
  const busy=props.selection!==null||props.runtime.workers.some(w=>w.phase!=='seated')||props.runtime.queue.length>0;
  const policy={online:props.runtime.online,reducedMotion:props.reducedMotion,busy};
  useEffect(()=>{
    const now=Date.now(),cooldown=()=>20000+(Math.imul(++cycle.current,9973)>>>0)%20001;
    if(ambient) {
      if(!retainAmbientVisit(layout,ambient,ambientActors,now,policy)) {
        nextVisit.current=now+cooldown();setAmbient(null);return;
      }
      const boundary=now<ambient.dwellAt?ambient.dwellAt:now<ambient.returnAt?ambient.returnAt:ambient.endsAt;
      const timer=setTimeout(()=>setWake(v=>v+1),Math.max(1,boundary-now));
      return()=>clearTimeout(timer);
    }
    if(props.style.id!=='precinct'||props.reducedMotion||!props.runtime.online)return;
    const timer=setTimeout(()=>{
      const seed=7+cycle.current;
      const visits=ambientActors.map(a=>planAmbientVisit(layout,a,Date.now(),seed,policy)).filter(v=>v!==null);
      const visit=visits.length?visits[seed%visits.length]:null;
      if(visit)setAmbient(visit);else{nextVisit.current=Date.now()+cooldown();setWake(v=>v+1);}
    },Math.max(1,nextVisit.current-now));
    return()=>clearTimeout(timer);
  },[layout,props.style.id,props.reducedMotion,props.runtime.online,props.selection,props.runtime.workers,props.runtime.queue,actors,ambient,wake]);
  useEffect(()=>{gl.domElement.dataset.ambientActor=ambient?.actorId??'';},[gl,ambient]);
  const active=props.runtime.online&&(!!ambient||actors.some(a=>a.status==='working')||props.runtime.workers.some(w=>['entering','leaving'].includes(w.phase))||props.runtime.queue.some(e=>e.startedAt!==undefined));
  return (
    <AnimationDriver active={active} reducedMotion={props.reducedMotion||!props.runtime.online}>
      {actors.map((a) => (
        <Actor
          key={a.id}
          actor={a}
          registry={registry}
          onSelect={onSelect}
          props={props}
          ambient={ambient?.actorId===a.id?ambient:undefined}
        />
      ))}
    </AnimationDriver>
  );
}
function Actor({
  actor: a,
  registry,
  onSelect,
  props,
  ambient,
}: {
  actor: ActorDescriptor;
  registry: MutableRefObject<Map<string, Group>>;
  onSelect: OfficeCanvasProps["onSelect"];
  props: OfficeCanvasProps;
  ambient?: AmbientVisit;
}) {
  const l=props.style.layout;
  const {invalidate}=useThree();
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
    invalidate();
    if (props.reducedMotion) group.current!.position.set(...a.position);
  }, [a.position, props.reducedMotion]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const worker = a.worker;
    const moving =
      worker && (worker.phase === "entering" || worker.phase === "leaving");
    walking.current = false;
    if(ambient&&!props.reducedMotion) {
      const now=Date.now(),rest=l.restSeats.find(s=>s.id===ambient.restSeatId)!;
      if(now>=ambient.dwellAt&&now<ambient.returnAt){g.position.set(...rest.position);g.rotation.y=rest.rotation;}
      else {
        const outward=now<ambient.dwellAt;
        const sampled=samplePath(outward?ambient.outward:ambient.returning,now-(outward?ambient.startedAt:ambient.returnAt),2.2);
        g.position.set(...sampled.position);g.rotation.y=sampled.done?a.rotation:sampled.heading;walking.current=!sampled.done;
      }
    }else if (moving) {
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
      }else invalidate();
    } else {
      g.position.set(...a.position);
      g.rotation.y = a.rotation;
    }
  });
  const moving =
    (visiting || (!!ambient&&(Date.now()<ambient.dwellAt||Date.now()>=ambient.returnAt)) || (!!a.worker && ["entering", "leaving"].includes(a.worker.phase))) &&
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
        rest={!!a.rest||!!ambient}
        walking={walking}
        onSelect={() => onSelect(a.selection)}
      />
    </group>
  );
}
