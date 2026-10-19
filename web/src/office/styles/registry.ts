import { BOTANICAL_LAYOUT } from './botanical/layout';
import { PRECINCT_LAYOUT } from './precinct/layout';
import type { OfficeStyleDefinition, OfficeStyleId } from './types';
import type { Vec3 } from '../types';
const anchors = (layout:OfficeStyleDefinition['layout']) => Object.fromEntries(layout.rooms.map(r=>[r.id,[r.x+r.width/2,0,r.z+r.depth/2] as Vec3]));
const botanical:OfficeStyleDefinition = {
  id:'botanical',label:'Botanical Studio',layout:BOTANICAL_LAYOUT,labelAnchors:anchors(BOTANICAL_LAYOUT),
  views:{overview:{position:[-26,28,40],target:[0,0,0],zoomRatio:1}},
};
const precinct:OfficeStyleDefinition = {
  id:'precinct',label:'Nine-Nine Precinct',layout:PRECINCT_LAYOUT,
  labelAnchors:{...anchors(PRECINCT_LAYOUT),kitchenette:[4.1,0,2.7]},
  views:{
    overview:{position:[43,39,51],target:[14,0,9],zoomRatio:1},
    reverse:{position:[-20,37,45],target:[14,0,9],zoomRatio:1.15/1.2},
    plan:{position:[14,70,10.001],target:[14,0,10],zoomRatio:1.05/1.2},
    pantry:{position:[13.5,12.8,34.5],target:[3.7,1.1,21.7],zoomRatio:2.7/1.2},
    kitchenette:{position:[16,13,18],target:[4.1,1.2,2.7],zoomRatio:2.9/1.2},
    management:{position:[39,13,28],target:[27.7,1,14],zoomRatio:2.8/1.2},
  },
};
export function isOfficeStyleId(value:unknown):value is OfficeStyleId {return value==='botanical'||value==='precinct';}
export function getOfficeStyle(id:OfficeStyleId):OfficeStyleDefinition {return id==='precinct'?precinct:botanical;}
