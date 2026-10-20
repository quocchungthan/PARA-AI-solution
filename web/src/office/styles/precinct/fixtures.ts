import type { Rect } from '../../layout';
import type { Vec3 } from '../../types';
export type PrecinctFixture = {
  id: string; kind: 'desk'|'sofa'|'pool'|'vending'|'counter'|'cabinet'|'table';
  position: Vec3; rotation: number; footprint: Rect;
};
function fixture(id: string, kind: PrecinctFixture['kind'], x: number,z: number,w: number,d: number,rotation=0): PrecinctFixture {
  return {id,kind,position:[x,0,z],rotation,footprint:{x:x-w/2,z:z-d/2,width:w,depth:d}};
}
export const PRECINCT_FIXTURES: readonly PrecinctFixture[] = [
  ...[[4.1,10.7,0],[10.3,7.25,0],[10.3,5.65,Math.PI],[18.2,4.65,0],
    [12.3,14.45,0],[12.3,12.85,Math.PI],[20.5,12.25,0],[20.5,10.65,Math.PI],[4.3,16.2,Math.PI]].map(([x,z,r],i)=>fixture('bullpen-'+i,'desk',x,z,3.04,1.59,r)),
  fixture('captain-desk','desk',27.7,13.2,1.65,3.8,Math.PI/2),
  fixture('side-desk','desk',27.7,6.2,1.59,3.04,Math.PI/2),
  fixture('research-desk','desk',2,-3,2,1),
  fixture('rear-desk','desk',6,-3,2,1),
  ...[13,16,19,22].map((x,i)=>fixture('briefing-'+i,'desk',x,-4,2.4,.8)),
  fixture('sofa','sofa',2.6,24.45,3.8,1.05),
  fixture('pool','pool',5.65,23.15,1.65,2.85,Math.PI/2),
  fixture('vending-snacks','vending',.65,20.1,1.1,1.3,Math.PI/2),
  fixture('vending-coffee','vending',.65,21.65,1.1,1.3,Math.PI/2),
  fixture('coffee-counter','counter',3.5,18.65,3.85,1.14),
  fixture('kitchen-counter','counter',3.85,1.2,5.7,1.18),
  fixture('kitchen-return','counter',6.3,2.1,1.17,1.88),
  fixture('fridge','cabinet',.38,1.33,1.45,1.38),
  fixture('cafe','table',4.05,4.25,1.5,1.25),
  fixture('break-table','table',3.45,21.1,1.4,1.4),
  fixture('bookshelf','cabinet',30.7,14,.6,6.4),
  fixture('copier','cabinet',23.05,14.2,1.1,.84),
  fixture('files','cabinet',22.95,15.5,1.05,.9),
  fixture('entry-cabinet','cabinet',.9,8.6,1.35,.85),
  fixture('kitchen-pillar','cabinet',7.35,3.1,.86,.86),
  fixture('kitchen-dispenser','cabinet',8.02,3.4,.65,.64),
  fixture('kitchen-bin','cabinet',6.5,4.1,.86,.86),
  fixture('lounge-dispenser','cabinet',6.83,18.6,.65,.65),
];

// Decorative storage also blocks circulation beside the staggered desks.
const deskStorage=PRECINCT_FIXTURES.filter(f=>f.id.startsWith('bullpen-')).flatMap((f,i)=>{
 if(i%2)return [];
 const x=f.position[0]-1.9*Math.cos(f.rotation)+.3*Math.sin(f.rotation),z=f.position[2]+1.9*Math.sin(f.rotation)+.3*Math.cos(f.rotation);
 return [fixture('storage-'+i,'cabinet',x,z,.74,.78,f.rotation)];
});
export const PRECINCT_SOLID_STORAGE:readonly Rect[]=deskStorage.map(f=>f.footprint);
export const PRECINCT_PILLARS:readonly Rect[]=[[0,0],[0,5.1],[8.3,0],[11,0],[24,0],[24,10],[24,18],[31.4,10],[31.4,18],[0,18],[7.4,18]].map(([x,z])=>({x:x-.325,z:z-.325,width:.65,depth:.65}));
