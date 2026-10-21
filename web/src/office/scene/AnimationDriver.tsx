import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {idleAnimationWindow} from './motion';
const idleContext=createContext(false);
export const useIdleMotion=()=>useContext(idleContext);
export function AnimationDriver({active,reducedMotion,children}:{active:boolean;reducedMotion:boolean;children:ReactNode}) {
  const {invalidate}=useThree(),epoch=useRef(Date.now());
  const [window,setWindow]=useState(()=>idleAnimationWindow(0,7));
  const gesture=!reducedMotion&&!active&&window.active;
  useEffect(()=>{
    invalidate();
    if(reducedMotion)return;
    const timer=setTimeout(()=>setWindow(idleAnimationWindow(Date.now()-epoch.current,7)),Math.max(16,window.wakeInMs));
    return()=>clearTimeout(timer);
  },[reducedMotion,active,window,invalidate]);
  useFrame(()=>{if(!reducedMotion&&(active||gesture))invalidate();});
  return <idleContext.Provider value={gesture}>{children}</idleContext.Provider>;
}
