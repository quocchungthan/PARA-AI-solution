import type { OfficeLayout, Room, Seat, Wall } from '../../layout';
import type { OfficeRole, Vec3 } from '../../types';
import { createWalkGraph } from '../../routes';
import { PRECINCT_FIXTURES,PRECINCT_PILLARS,PRECINCT_SOLID_STORAGE,PRECINCT_CHAIR_OBSTACLES } from './fixtures';

const rooms: Room[] = [
  {id:'team',name:'Detective bullpen',x:0,z:0,width:24,depth:18},
  {id:'pantry',name:'Break room',x:0,z:18,width:7.4,depth:7.3},
  {id:'management',name:"Captain’s office",x:24,z:10,width:7.4,depth:8},
  {id:'hr',name:'Side office',x:24,z:3.2,width:7.4,depth:6.8},
  {id:'briefing',name:'Briefing room',x:11,z:-6,width:13,depth:6},
  {id:'creative',name:'Records',x:4,z:-5,width:7,depth:5},
  {id:'research',name:'Research office',x:0,z:-5,width:4,depth:5},
];
const roles: Partial<Record<string,OfficeRole>> = {
  'bullpen-0':'functional-reviewer','bullpen-1':'coder','bullpen-2':'reviewer',
  'bullpen-3':'scrum-master','bullpen-4':'coordinator','side-desk':'hr','research-desk':'researcher','rear-desk':'product-owner',
};
const seats: Seat[] = PRECINCT_FIXTURES.filter(f=>f.kind==='desk'&&f.id!=='captain-desk').map(f=>{
  const [x,,z]=f.position, side=f.rotation===Math.PI?-1:1;
  const sideways=f.rotation===Math.PI/2;
  return {id:f.id,position:sideways?[x+1.5,0,z]:[x,0,z+side*1.5],
    approach:sideways?[x+2.15,0,z]:[x,0,z+side*2.15],
    rotation:sideways?-Math.PI/2:f.rotation+Math.PI,reservedFor:roles[f.id]};
});
// Records seating supplements the briefing and bullpen without changing the outline.
seats.push({id:'records-worker',position:[9.5,0,-2.5],approach:[9.5,0,-1.5],rotation:Math.PI});
seats.push({id:'records-worker-2',position:[8,0,-2.5],approach:[8,0,-1.5],rotation:Math.PI});
const wall = (x1:number,z1:number,x2:number,z2:number,cutawayHeight=1.1):Wall => ({from:[x1,0,z1],to:[x2,0,z2],height:3.25,cutawayHeight});
const walls: Wall[] = [
  wall(0,-5,0,25.3,.65),wall(0,-5,4,-5,3.25),wall(4,-5,4,-1.5),
  wall(11,-6,24,-6,3.25),wall(11,-6,11,-1.5),wall(24,-6,24,0),
  wall(0,0,7.8,0,3.25),wall(9.8,0,15,0),wall(17,0,24,0),
  wall(31.4,3.2,31.4,18,.8),wall(24,3.2,31.4,3.2,3.25),wall(24,10,31.4,10,3.25),
  wall(24,3.2,24,6.8),wall(24,8.8,24,12.5),wall(24,14.5,24,18),
  wall(0,18,5.2,18),wall(7.2,18,7.4,18),
];
const wallRects = walls.map(w=>({x:Math.min(w.from[0],w.to[0])-.11,z:Math.min(w.from[2],w.to[2])-.11,
  width:Math.abs(w.to[0]-w.from[0])+.22,depth:Math.abs(w.to[2]-w.from[2])+.22}));
export const PRECINCT_LAYOUT:OfficeLayout = {
  bounds:{x:0,z:-6,width:31.4,depth:31.3},rooms,
  floorAreas:rooms.map(({x,z,width,depth})=>({x,z,width,depth})),
  desks:PRECINCT_FIXTURES.filter(f=>f.kind==='desk').map(f=>f.footprint),
  obstacles:[...PRECINCT_FIXTURES.map(f=>f.footprint),...PRECINCT_PILLARS,...PRECINCT_SOLID_STORAGE,...PRECINCT_CHAIR_OBSTACLES,...wallRects],walls,
  doors:[[9,0,0],[16,0,0],[24,0,7.8],[24,0,13.5],[6.2,0,18]],
  seats,leads:Object.fromEntries(seats.filter(s=>s.reservedFor).map(s=>[s.reservedFor,s.position])) as OfficeLayout['leads'],
  human:[29.2,0,13.2],humanRotation:-Math.PI/2,entry:[1.5,0,7.5],
  restSeats:[...[1.7,3.2].map((x,i)=>({id:'break-sofa-'+i,position:[x,0,24.45] as Vec3,approach:[x,0,23.25] as Vec3,rotation:Math.PI})),
    {id:'kitchen-coffee',position:[2.8,0,4.25],approach:[2,0,4.25],rotation:Math.PI/2}],
  walkGraph:{nodes:[],edges:[]},
};
PRECINCT_LAYOUT.walkGraph=createWalkGraph(PRECINCT_LAYOUT);
