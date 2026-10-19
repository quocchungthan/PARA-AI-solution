import {useMemo,type ReactNode} from 'react';
import {PRECINCT_LAYOUT} from './layout';
import {precinctPalette} from './palette';
import {buildPrecinctShell} from './shell';
import {buildBullpen} from './bullpen';
import {buildBreakRoom} from './breakRoom';
import {buildKitchenette} from './kitchenette';
import {buildOffices} from './offices';
import {PrecinctResources} from './resources';
export default function PrecinctScene({theme,cutaway,children}:{theme:'light'|'dark';cutaway:boolean;children?:ReactNode}) {
  const p=useMemo(()=>precinctPalette(theme),[theme]);
  const geometry=useMemo(()=>{
    const parts=[buildPrecinctShell(PRECINCT_LAYOUT,p,cutaway),buildBullpen(PRECINCT_LAYOUT,p),buildBreakRoom(PRECINCT_LAYOUT,p),buildKitchenette(PRECINCT_LAYOUT,p),buildOffices(PRECINCT_LAYOUT,p,cutaway)];
    return {boxes:parts.flatMap(g=>g.boxes),rounds:parts.flatMap(g=>g.rounds),panels:parts.flatMap(g=>g.panels)};
  },[p,cutaway]);
  return <><color attach="background" args={[p.background]}/>
    <hemisphereLight args={['#fff9e6','#7f8c7c',2.25]}/>
    <directionalLight position={[-12,38,16]} intensity={3.1} color="#fff4da" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={38} shadow-camera-bottom={-38} shadow-camera-far={100} shadow-normalBias={.035}/>
    <directionalLight position={[30,20,-20]} intensity={1} color="#bfcfda"/>
    <PrecinctResources geometry={geometry}/>{children}</>;
}
