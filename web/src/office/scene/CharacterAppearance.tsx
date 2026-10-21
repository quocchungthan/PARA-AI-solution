import {createContext,useContext,type ReactNode} from 'react';
import type {CharacterKind} from './Character';
import type {OfficeRole} from '../types';
import type {RigPart} from './resources';
export type CharacterRigBuilder=(kind:CharacterKind,role:OfficeRole,identitySeed:string,pose:'seated'|'standing')=>readonly RigPart[];
type CastName=(kind:CharacterKind,role:OfficeRole,identitySeed:string)=>string;
const context=createContext<{buildRig:CharacterRigBuilder;castName?:CastName}|null>(null);
export function CharacterAppearanceProvider({buildRig,castName,children}:{buildRig:CharacterRigBuilder;castName?:CastName;children:ReactNode}){
  return <context.Provider value={{buildRig,castName}}>{children}</context.Provider>;
}
export const useCharacterRig=()=>useContext(context)?.buildRig??null;
export const useCharacterCastName=()=>useContext(context)?.castName;
