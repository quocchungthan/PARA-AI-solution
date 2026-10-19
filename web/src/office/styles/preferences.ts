import type { CameraPose } from '../types';
import { isOfficeStyleId } from './registry';
import type { OfficeStyleId } from './types';
export type OfficePreferences = {version:1;styleId:OfficeStyleId;camerasByStyle:Partial<Record<OfficeStyleId,CameraPose>>};
const KEY='para-office-presentation-v1';
const defaults=():OfficePreferences=>({version:1,styleId:'botanical',camerasByStyle:{}});
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const vector=(v:unknown):v is CameraPose['position']=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n));
function clean(value:unknown):OfficePreferences {
  if(!record(value)||value.version!==1||!isOfficeStyleId(value.styleId))return defaults();
  const camerasByStyle:OfficePreferences['camerasByStyle']={};
  if(record(value.camerasByStyle))for(const id of ['botanical','precinct'] as const) {
    const p=value.camerasByStyle[id];
    if(!record(p)||!vector(p.position)||!vector(p.target)||!positive(p.zoom)||
      (p.homeZoom!==undefined&&!positive(p.homeZoom))||(p.viewportWidth!==undefined&&!positive(p.viewportWidth)))continue;
    camerasByStyle[id]={position:p.position,target:p.target,zoom:p.zoom,
      ...(p.homeZoom===undefined?{}:{homeZoom:p.homeZoom as number}),
      ...(p.viewportWidth===undefined?{}:{viewportWidth:p.viewportWidth as number})};
  }
  return {version:1,styleId:value.styleId,camerasByStyle};
}
export function readOfficePreferences(storage:Pick<Storage,'getItem'>):OfficePreferences {
  try{return clean(JSON.parse(storage.getItem(KEY)??'null'));}catch{return defaults();}
}
export function writeOfficePreferences(storage:Pick<Storage,'setItem'>,preferences:OfficePreferences):void {
  try{storage.setItem(KEY,JSON.stringify(clean(preferences)));}catch{/* Storage is optional presentation state. */}
}
