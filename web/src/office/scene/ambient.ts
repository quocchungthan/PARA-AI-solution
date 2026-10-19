import type {OfficeLayout} from '../layout';
import type {Vec3} from '../types';
import type {CharacterKind} from './Character';
import {findRoute,pathDuration} from '../routes';
export type AmbientActor={id:string;position:Vec3;kind:CharacterKind;status:string;health:boolean;selected:boolean};
export type AmbientPolicy={online:boolean;reducedMotion:boolean;busy:boolean};
export type AmbientVisit={actorId:string;restSeatId:string;outward:readonly Vec3[];returning:readonly Vec3[];startedAt:number;dwellAt:number;returnAt:number;endsAt:number};
const eligible=(a:AmbientActor,p:AmbientPolicy)=>p.online&&!p.reducedMotion&&!p.busy&&!a.selected&&!a.health&&
  (a.kind==='lead'||a.kind==='assistant')&&['idle','waiting','done'].includes(a.status);
export function planAmbientVisit(layout:OfficeLayout,actor:AmbientActor,nowMs:number,seed:number,policy:AmbientPolicy):AmbientVisit|null {
  if(!eligible(actor,policy)||!layout.restSeats.length)return null;
  const seat=layout.restSeats[(seed>>>0)%layout.restSeats.length];
  const outward=findRoute(layout,actor.position,seat.position),returning=findRoute(layout,seat.position,actor.position);
  const dwellAt=nowMs+pathDuration(outward),returnAt=dwellAt+3000+(seed>>>0)%2001;
  return {actorId:actor.id,restSeatId:seat.id,outward,returning,startedAt:nowMs,dwellAt,returnAt,endsAt:returnAt+pathDuration(returning)};
}
export function retainAmbientVisit(layout:OfficeLayout,visit:AmbientVisit,actors:readonly AmbientActor[],nowMs:number,policy:AmbientPolicy):AmbientVisit|null {
  const actor=actors.find(a=>a.id===visit.actorId);
  return actor&&eligible(actor,policy)&&nowMs<visit.endsAt&&layout.restSeats.some(s=>s.id===visit.restSeatId)&&
    actor.position.join()===visit.returning.at(-1)?.join()?visit:null;
}
