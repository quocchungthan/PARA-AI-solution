import type {OfficeModel,OfficeRuntime,OfficeSelection,FloorRuntime,WorkerSlot,CameraPose,OfficeFloor,OfficeEvent} from './types';
import {OFFICE_LAYOUT as layout} from './layout';import {routeDuration} from './routes';import {officeRole} from './roles';import {collectOfficeEvents} from './events';
export type OfficeAction={type:'snapshot';model:OfficeModel;nowMs:number}|{type:'connectivity';online:boolean;nowMs:number}|{type:'selectFloor';floorId:string}|{type:'select';selection:OfficeSelection}|{type:'revealWorker';floorId:string;sessionId:string}|{type:'camera';floorId:string;pose:CameraPose}|{type:'tick';nowMs:number};
const temporarySeats=layout.seats.filter(s=>!s.reservedFor);
function allocate(id:string,model:OfficeModel,workers:readonly WorkerSlot[],now:number,phase:WorkerSlot['phase']='seated'):WorkerSlot {
 const free=temporarySeats.filter(s=>!workers.some(w=>w.seatId===s.id));const role=officeRole(model.sessionsById.get(id)?.agent);const seat=free.find(s=>s.rolePreference===role)||free.find(s=>!s.rolePreference)||free[0];
 return {sessionId:id,seatId:seat.id,identitySeed:id,phase,phaseStartedAt:now};
}
function hydrate(f:OfficeFloor,m:OfficeModel,old:FloorRuntime|undefined,now:number):FloorRuntime{
 const live=f.sessionIds.filter(id=>id!==f.rootId&&m.sessionsById.get(id)?.state!=='done');let workers=(old?.workers??[]).filter(w=>live.includes(w.sessionId)).map(w=>({...w,phase:'seated' as const}));for(const id of live)if(workers.length<10&&!workers.some(w=>w.sessionId===id))workers.push(allocate(id,m,workers,now) as typeof workers[number]);return {workers,queue:[],camera:old?.camera??null};
}
export function createOfficeRuntime(model:OfficeModel,online:boolean,nowMs:number):OfficeRuntime{return {model,online,selectedFloorId:model.floors[0]?.rootId??null,selection:null,floors:new Map(model.floors.map(f=>[f.rootId,hydrate(f,model,undefined,nowMs)]))}}
function reconcile(state:OfficeRuntime,m:OfficeModel,now:number,quiet:boolean):OfficeRuntime{
 const selected=m.floors.some(f=>f.rootId===state.selectedFloorId)?state.selectedFloorId:m.floors[0]?.rootId??null;const floors=new Map<string,FloorRuntime>();
 for(const f of m.floors){const old=state.floors.get(f.rootId);if(quiet||f.rootId!==selected||!old){floors.set(f.rootId,hydrate(f,m,old,now));continue}
  let workers:WorkerSlot[]=old.workers.filter(w=>f.sessionIds.includes(w.sessionId)&&m.sessionsById.has(w.sessionId)).map(w=>{const s=m.sessionsById.get(w.sessionId)!;if(s.state==='done'&&!['reporting','leaving'].includes(w.phase))return {...w,phase:'reporting',phaseStartedAt:now};if(s.state!=='done'&&['reporting','leaving'].includes(w.phase)||s.state!=='working'&&w.phase==='entering')return {...w,phase:'seated',phaseStartedAt:now};return w});
  const live=f.sessionIds.filter(id=>id!==f.rootId&&m.sessionsById.get(id)?.state!=='done');
  for(const id of live){if(workers.some(w=>w.sessionId===id))continue;if(workers.length>=10){const exit=workers.findIndex(w=>m.sessionsById.get(w.sessionId)?.state==='done');if(exit<0)continue;workers.splice(exit,1)}const entering=workers.filter(w=>w.phase==='entering'||w.phase==='reporting'||w.phase==='leaving').length;const s=m.sessionsById.get(id)!;workers.push(allocate(id,m,workers,now,entering<2&&s.registered!==false&&s.state==='working'?'entering':'seated'))}
  // Completion bursts are settled without staging a crowd of reporting bodies.
  let transient=0;workers=workers.filter(w=>{if(w.phase==='seated')return true;return ++transient<=2||m.sessionsById.get(w.sessionId)?.state!=='done'}).map(w=>w.phase==='entering'&&transient>2?{...w,phase:'seated'}:w);
  const queue=[...old.queue.filter(e=>e.startedAt!==undefined?now-e.startedAt<1500:now-e.createdAt<4000),...collectOfficeEvents(state.model,m,f.rootId,now)].slice(-12);let running=queue.filter(e=>e.startedAt!==undefined).length;const admitted=queue.map(e=>e.startedAt===undefined&&running++<2?{...e,startedAt:now}:e);
  floors.set(f.rootId,{workers,queue:admitted,camera:old.camera});
 }
 return {...state,model:m,selectedFloorId:selected,floors,notice:selected!==state.selectedFloorId&&state.selectedFloorId?'The previous floor is unavailable. Showing the next available conversation.':state.notice};
}
export function reduceOffice(state:OfficeRuntime,action:OfficeAction):OfficeRuntime{
 if(action.type==='snapshot')return reconcile(state,action.model,action.nowMs,!state.online);
 if(action.type==='connectivity'){if(state.online===action.online)return state;const next={...state,online:action.online};return reconcile(next,state.model,action.nowMs,true)}
 if(action.type==='select')return {...state,selection:action.selection};
 if(action.type==='selectFloor'){if(!state.model.floors.some(f=>f.rootId===action.floorId))return state;return {...state,selectedFloorId:action.floorId,selection:null,notice:undefined,floors:new Map([...state.floors].map(([id,f])=>[id,{...f,queue:[],workers:f.workers.filter(w=>state.model.sessionsById.get(w.sessionId)?.state!=='done').map(w=>({...w,phase:'seated' as const}))}]))}}
 const floors=new Map(state.floors);
 if(action.type==='camera'){const f=floors.get(action.floorId);if(f)floors.set(action.floorId,{...f,camera:action.pose});return {...state,floors}}
 if(action.type==='revealWorker'){const f=floors.get(action.floorId),floor=state.model.floors.find(v=>v.rootId===action.floorId);if(!f||!floor?.sessionIds.includes(action.sessionId)||action.sessionId===action.floorId||state.model.sessionsById.get(action.sessionId)?.state==='done'||f.workers.some(w=>w.sessionId===action.sessionId))return state;const workers=[...f.workers];if(workers.length>=10){let i=workers.length-1;if(state.selection?.kind==='session'&&workers[i].sessionId===state.selection.sessionId)i--;workers.splice(Math.max(i,0),1)}workers.push(allocate(action.sessionId,state.model,workers,Date.now()));floors.set(action.floorId,{...f,workers});return {...state,floors}}
 if(action.type==='tick'&&state.online&&state.selectedFloorId){const f=floors.get(state.selectedFloorId);if(!f)return state;let changed=false;const workers=f.workers.flatMap(w=>{const seat=layout.seats.find(s=>s.id===w.seatId)!;const elapsed=action.nowMs-w.phaseStartedAt;let phase=w.phase;
  if(w.phase==='entering'&&elapsed>=routeDuration(layout,layout.entry,seat.approach))phase='seated';
  if(w.phase==='reporting'&&elapsed>=1500)phase='leaving';
  if(w.phase==='leaving'&&elapsed>=routeDuration(layout,seat.approach,layout.entry)){changed=true;return []}if(phase!==w.phase){changed=true;return [{...w,phase,phaseStartedAt:action.nowMs}]}return [w]});
  let active=0;const queue:OfficeEvent[]=f.queue.filter(e=>e.startedAt!==undefined?action.nowMs-e.startedAt<1500:action.nowMs-e.createdAt<4000).map(e=>{if(e.startedAt!==undefined){active++;return e}if(active++<2){changed=true;return {...e,startedAt:action.nowMs}}return e});if(queue.length!==f.queue.length)changed=true;if(!changed)return state;floors.set(state.selectedFloorId,{...f,workers,queue});return {...state,floors};
 }return state;
}
