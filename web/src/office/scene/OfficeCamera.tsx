import {useEffect,useRef,type RefObject} from 'react';
import {useThree} from '@react-three/fiber';
import {Vector3,MOUSE,TOUCH,MathUtils,OrthographicCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {OfficeLayout} from '../layout';
import type {CameraPose,OfficeCameraHandle} from '../types';
import type {OfficeStyleDefinition} from '../styles/types';
export function OfficeCamera({layout,views,pose,focusRoom,onChange,controllerRef}:{
  layout:OfficeLayout;views:OfficeStyleDefinition['views'];pose:CameraPose|null;focusRoom?:string|null;
  onChange:(p:CameraPose)=>void;controllerRef:RefObject<OfficeCameraHandle|null>;reducedMotion:boolean;
}) {
  const {camera,gl,size,invalidate}=useThree();
  const latest=useRef({pose,onChange,focusRoom});latest.current={pose,onChange,focusRoom};
  useEffect(()=>{
    const c=camera as OrthographicCamera,controls=new OrbitControls(c,gl.domElement),overview=views.overview;
    controls.enableDamping=false;controls.minPolarAngle=.00001;controls.maxPolarAngle=MathUtils.degToRad(85);
    controls.mouseButtons.LEFT=MOUSE.ROTATE;controls.mouseButtons.RIGHT=MOUSE.PAN;
    controls.touches.ONE=TOUCH.ROTATE;controls.touches.TWO=TOUCH.DOLLY_PAN;
    controls.screenSpacePanning=true;controls.zoomSpeed=.7;controls.panSpeed=.8;
    c.position.set(...overview.position);controls.target.set(...overview.target);c.lookAt(controls.target);c.updateMatrixWorld();c.updateProjectionMatrix();
    let maxX=0,maxY=0;
    const r=layout.bounds;
    for(const x of [r.x,r.x+r.width])for(const y of [-.5,4])for(const z of [r.z,r.z+r.depth]) {
      const v=new Vector3(x,y,z).applyMatrix4(c.matrixWorldInverse);maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));
    }
    const homeZoom=Math.min(size.width/(maxX*2.2),size.height/(maxY*2.2));
    controls.minZoom=homeZoom*.6;controls.maxZoom=homeZoom*3.2;
    function save() {
      latest.current.onChange({position:c.position.toArray() as [number,number,number],target:controls.target.toArray() as [number,number,number],zoom:c.zoom,homeZoom,viewportWidth:size.width});invalidate();
    }
    function focusView(id:string) {
      const v=views[id];if(!v)return;
      c.position.set(...v.position);controls.target.set(...v.target);c.zoom=homeZoom*v.zoomRatio;c.updateProjectionMatrix();controls.update();save();
    }
    function focus(id:string) {
      if(views[id])return focusView(id);
      const room=layout.rooms.find(r=>r.id===id);if(!room)return focusView('overview');
      const offset=c.position.clone().sub(controls.target);controls.target.set(room.x+room.width/2,0,room.z+room.depth/2);
      c.position.copy(controls.target).add(offset);c.zoom=homeZoom*1.85;c.updateProjectionMatrix();controls.update();save();
    }
    controllerRef.current={home:()=>focusView('overview'),focusRoom:focus,focusView};
    const initial=latest.current.pose;
    if(initial) {
      c.position.set(...initial.position);controls.target.set(...initial.target);
      c.zoom=Math.max(controls.minZoom,Math.min(controls.maxZoom,initial.homeZoom?initial.zoom/initial.homeZoom*homeZoom:initial.zoom));
      c.updateProjectionMatrix();controls.update();save();
    }else if(latest.current.focusRoom)focus(latest.current.focusRoom);else focusView('overview');
    const redraw=()=>invalidate();controls.addEventListener('change',redraw);controls.addEventListener('end',save);
    return()=>{controls.removeEventListener('change',redraw);controls.removeEventListener('end',save);controls.dispose();controllerRef.current=null;};
  },[camera,gl,size.width,size.height,layout,views,controllerRef,invalidate]);
  return null;
}
