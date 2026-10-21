import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {CanvasTexture,Color,CylinderGeometry,DoubleSide,InstancedMesh,MeshBasicMaterial,MeshLambertMaterial,Object3D,PlaneGeometry,SphereGeometry,SRGBColorSpace,TorusGeometry} from 'three';
import type {PanelInstance,PrecinctGeometry,RoundInstance} from './primitives';
import {VoxelBatch} from '../../scene/resources';

function texture(surface:PanelInstance['surface']) {
  const c=document.createElement('canvas');c.width=256;c.height=192;const ctx=c.getContext('2d')!;
  if(surface==='monitor') {
    ctx.fillStyle='#274c43';ctx.fillRect(0,0,256,192);ctx.fillStyle='#bfd4b9';ctx.fillRect(21,24,214,20);
    ctx.fillStyle='#e8e8ce';ctx.fillRect(28,59,200,106);ctx.fillStyle='#526b64';
    for(let i=0;i<5;i++)ctx.fillRect(43,75+i*15,100+(i%2)*42,5);
  }else if(surface==='flag') {
    for(let i=0;i<13;i++){ctx.fillStyle=i%2?'#e7e0ce':'#a15a50';ctx.fillRect(0,i*192/13,256,192/13+1);}
    ctx.fillStyle='#3d5270';ctx.fillRect(0,0,108,104);ctx.fillStyle='#eee8d5';for(let i=0;i<25;i++)ctx.fillRect(10+(i%5)*20,9+Math.floor(i/5)*19,4,4);
  }else {
    ctx.fillStyle='#253b50';ctx.fillRect(0,0,256,192);ctx.fillStyle='#c9aa55';ctx.beginPath();
    ctx.moveTo(80,30);ctx.lineTo(176,30);ctx.lineTo(176,104);ctx.lineTo(128,164);ctx.lineTo(80,104);ctx.fill();
    ctx.fillStyle='#293c4a';ctx.font='bold 46px serif';ctx.textAlign='center';ctx.fillText('99',128,100);
  }
  const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;return t;
}
function RoundBatch({items}:{items:readonly RoundInstance[]}) {
  const mesh=useRef<InstancedMesh>(null);
  const resources=useMemo(()=>{
    const p=items[0].parameters;
    const geometry=items[0].kind==='cylinder'?new CylinderGeometry(...p):items[0].kind==='sphere'?new SphereGeometry(...p):new TorusGeometry(...p);
    return {geometry,material:new MeshLambertMaterial()};
  },[items]);
  useLayoutEffect(()=>{
    const o=new Object3D(),c=new Color();items.forEach((v,i)=>{o.position.set(...v.position);o.rotation.set(...v.rotation);o.scale.set(...v.scale);o.updateMatrix();mesh.current!.setMatrixAt(i,o.matrix);mesh.current!.setColorAt(i,c.set(v.color));});
    mesh.current!.instanceMatrix.needsUpdate=true;if(mesh.current!.instanceColor)mesh.current!.instanceColor.needsUpdate=true;mesh.current!.computeBoundingSphere();
  },[items,resources]);
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose();},[resources]);
  return <instancedMesh ref={mesh} args={[resources.geometry,resources.material,items.length]} castShadow receiveShadow/>;
}
function PanelBatch({items}:{items:readonly PanelInstance[]}) {
  const mesh=useRef<InstancedMesh>(null),surface=items[0].surface;
  const r=useMemo(()=>{
    const map=surface==='glass'?null:texture(surface);
    return {geometry:new PlaneGeometry(),map,material:new MeshBasicMaterial({map,side:DoubleSide,...(surface==='glass'?{color:'#a6b6af',transparent:true,opacity:.16,depthWrite:false}:{})})};
  },[surface]);
  useLayoutEffect(()=>{const o=new Object3D();items.forEach((v,i)=>{o.position.set(...v.position);o.rotation.set(...v.rotation);o.scale.set(v.width,v.height,1);o.updateMatrix();mesh.current!.setMatrixAt(i,o.matrix);});mesh.current!.instanceMatrix.needsUpdate=true;mesh.current!.computeBoundingSphere();},[items,r]);
  useEffect(()=>()=>{r.geometry.dispose();r.material.dispose();r.map?.dispose();},[r]);
  return <instancedMesh ref={mesh} args={[r.geometry,r.material,items.length]}/>;
}
export function PrecinctResources({geometry}:{geometry:PrecinctGeometry}) {
  const groups=useMemo(()=>{
    const rounds=new Map<string,RoundInstance[]>(),panels=new Map<string,PanelInstance[]>();
    for(const v of geometry.rounds){const key=v.kind+v.parameters.join();if(!rounds.has(key))rounds.set(key,[]);rounds.get(key)!.push(v);}
    for(const v of geometry.panels){if(!panels.has(v.surface))panels.set(v.surface,[]);panels.get(v.surface)!.push(v);}
    return {rounds:[...rounds],panels:[...panels]};
  },[geometry]);
  return <><VoxelBatch voxels={geometry.boxes}/>{groups.rounds.map(([key,items])=><RoundBatch key={key} items={items}/>)}{groups.panels.map(([key,items])=><PanelBatch key={key} items={items}/>)}</>;
}
