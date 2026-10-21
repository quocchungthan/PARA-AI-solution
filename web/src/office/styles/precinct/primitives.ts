import {Euler,Quaternion,Vector3} from 'three';
import type {Voxel} from '../../scene/resources';
import type {Vec3} from '../../types';
import type {PrecinctPalette} from './palette';
export type RoundInstance = {kind:'cylinder'|'sphere'|'torus';position:Vec3;rotation:Vec3;scale:Vec3;color:string;parameters:readonly number[]};
export type PanelInstance = {position:Vec3;rotation:Vec3;width:number;height:number;surface:'glass'|'monitor'|'flag'|'badge'};
export type PrecinctGeometry = {boxes:readonly Voxel[];rounds:readonly RoundInstance[];panels:readonly PanelInstance[]};
export type ModelGroup = {x:number;z:number;angle:number};
export function createPrecinctBuilder(C:PrecinctPalette) {
  const boxes:Voxel[]=[],rounds:RoundInstance[]=[],panels:PanelInstance[]=[];
  const furniture:ModelGroup={x:0,z:0,angle:0},walls=furniture;
  const point=(g:ModelGroup,x:number,y:number,z:number):Vec3=>[g.x+x*Math.cos(g.angle)+z*Math.sin(g.angle),y,g.z-x*Math.sin(g.angle)+z*Math.cos(g.angle)];
  function group(x=0,z=0,angle=0,parent=furniture):ModelGroup {const p=point(parent,x,0,z);return{x:p[0],z:p[2],angle:parent.angle+angle};}
  function box(g:ModelGroup,x:number,y:number,z:number,w:number,h:number,d:number,c:string) {
    const v:Voxel={position:point(g,x,y,z),size:[w,h,d],color:c,rotation:g.angle};boxes.push(v);
    return{rotation:{set y(a:number){v.rotation=g.angle+a;}}};
  }
  function round(g:ModelGroup,x:number,y:number,z:number,kind:RoundInstance['kind'],scale:Vec3,c:string,parameters:readonly number[],rot:Vec3=[0,0,0]) {
    const local=new Quaternion().setFromEuler(new Euler(...rot));
    local.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),g.angle));
    const e=new Euler().setFromQuaternion(local);
    const v:RoundInstance={kind,position:point(g,x,y,z),rotation:[e.x,e.y,e.z],scale,color:c,parameters};rounds.push(v);
    return{rotation:{set x(a:number){v.rotation=[a,g.angle,0];}}};
  }
  function cylinder(g:ModelGroup,x:number,y:number,z:number,r:number,h:number,c:string,rTop=r,n=12){return round(g,x,y,z,'cylinder',[r,h,r],c,[rTop/r,1,1,n]);}
  function ball(g:ModelGroup,x:number,y:number,z:number,r:number,c:string){return round(g,x,y,z,'sphere',[r,r,r],c,[1,12,8]);}
  function rod(g:ModelGroup,a:readonly number[],b:readonly number[],r:number,c:string){
    const direction=new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const e=new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize()));
    return round(g,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,'cylinder',[r,direction.length(),r],c,[1,1,1,8],[e.x,e.y,e.z]);
  }
  function ring(g:ModelGroup,x:number,y:number,z:number,r:number,t:number,c:string,rotation:Vec3=[Math.PI/2,0,0]){return round(g,x,y,z,'torus',[r,r,r],c,[1,t/r,6,16],rotation);}
  function panel(g:ModelGroup,x:number,y:number,z:number,w:number,h:number,surface:PanelInstance['surface'],rotation=0){panels.push({position:point(g,x,y,z),rotation:[0,g.angle+rotation,0],width:w,height:h,surface});}
  const screenTexture='monitor' as const,badgeTexture='badge' as const,flagTexture='flag' as const;
  return {C,boxes,rounds,panels,furniture,walls,group,box,cylinder,ball,rod,ring,panel,screenTexture,badgeTexture,flagTexture,
    geometry:():PrecinctGeometry=>({boxes,rounds,panels})};
}
