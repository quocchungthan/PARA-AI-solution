import type {CharacterKind} from '../../scene/Character';
import type {OfficeRole,Vec3} from '../../types';
import type {RigPart,Voxel} from '../../scene/resources';
export type PrecinctAppearance={castId:string;skin:string;hair:string;shirt:string;hairStyle:'short'|'bald'|'long'|'curly';glasses:boolean;tie:boolean;suspenders:boolean;build:'regular'|'broad'};
const appearance=(castId:string,skin:string,hair:string,shirt:string,hairStyle:PrecinctAppearance['hairStyle']='short',extra:Partial<PrecinctAppearance>={}):PrecinctAppearance=>({castId,skin,hair,shirt,hairStyle,glasses:false,tie:false,suspenders:false,build:'regular',...extra});
const cast={
  human:appearance('Holt','#80543c','#35312a','#e4e1d2','bald',{tie:true}),
  coordinator:appearance('Amy','#d1a17a','#3c2c25','#56616a','long'),
  coder:appearance('Jake','#dbac82','#49352b','#8b4140'),
  reviewer:appearance('Rosa','#bf8d68','#252427','#303238','long'),
  'functional-reviewer':appearance('Boyle','#dfb894','#5b4736','#bcad8a','short',{tie:true}),
  'scrum-master':appearance('Terry','#936443','#382e26','#ad6953','bald',{suspenders:true,build:'broad'}),
  hr:appearance('Gina','#d7ab85','#77523a','#34353d','curly'),
  researcher:appearance('Kevin','#d5b28e','#77654d','#8c8170','short',{glasses:true,tie:true}),
};
const supporting=[appearance('Scully','#deb78d','#8a7b65','#607e98','short',{build:'broad',tie:true}),
  appearance('Hitchcock','#ddb18d','#816b51','#d3c2a5','bald',{build:'broad'}),
  appearance('Doug Judy','#865e45','#302b27','#8c4158','short',{glasses:true}),
  appearance('Pimento','#c7956c','#302a25','#6b7357','curly'),
  appearance('Karen','#ac795b','#322a28','#9a6276','curly')];
export function precinctAppearance(kind:CharacterKind,role:OfficeRole,identitySeed:string):PrecinctAppearance {
  if(kind==='human')return cast.human;
  if(kind!=='worker')return cast[role==='unknown'?'coder':role];
  const hash=[...identitySeed].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7);
  return supporting[hash%supporting.length];
}
export function buildPrecinctCharacter(a:PrecinctAppearance,pose:'seated'|'standing'):readonly RigPart[] {
  const body:Voxel[]=[],head:Voxel[]=[],left:Voxel[]=[],right:Voxel[]=[],leftLeg:Voxel[]=[],rightLeg:Voxel[]=[];
  const b=(list:Voxel[],position:Vec3,size:Vec3,color:string)=>list.push({position,size,color});
  const width=a.build==='broad'?.9:.68,armX=width/2+.1;
  b(body,[0,1.12,0],[width,.68,.42],a.shirt);b(body,[0,1.53,.02],[.2,.16,.2],a.skin);
  for(const side of [-1,1])b(body,[side*.095,1.41,.23],[.14,.13,.04],'#e1dac9');
  for(let i=0;i<4;i++)b(body,[0,1.31-i*.105,.231],[.025,.025,.015],'#393d3d');
  if(a.tie)b(body,[0,1.15,.25],[.08,.4,.035],a.castId==='Holt'?'#283f64':'#6e7154');
  if(a.suspenders)for(const side of [-1,1])b(body,[side*.25,1.18,.235],[.07,.62,.035],'#39312c');
  if(['Holt','Amy','Terry','Jake','Rosa'].includes(a.castId)){b(body,[-width*.27,1.3,.239],[.12,.15,.035],'#c0a255');b(body,[-width*.27,1.3,.262],[.04,.06,.01],'#56615b');}
  if(a.castId==='Jake')b(body,[0,1.17,.25],[.32,.47,.04],'#374552');
  if(a.castId==='Gina')for(let i=0;i<3;i++)b(body,[0,1.26-i*.09,.24],[.32-i*.04,.04,.025],'#e5dfcd');
  b(head,[0,.18,0],[.66,.62,.6],a.skin);
  if(a.hairStyle!=='bald') {
    b(head,[0,.53,-.03],[.72,.18,.65],a.hair);
    b(head,[-.29,.33,-.12],[.15,.3,.46],a.hair);b(head,[.29,.39,-.12],[.15,.24,.46],a.hair);
    b(head,[0,.43,-.31],[.64,.3,.12],a.hair);
  }
  if(a.hairStyle==='long'||a.hairStyle==='curly') {
    for(const side of [-1,1])b(head,[side*.34,.12,-.08],[.18,.78,.55],a.hair);
    b(head,[0,.04,-.32],[.67,.76,.16],a.hair);
  }
  if(a.hairStyle==='curly')for(let i=0;i<12;i++)b(head,[(i%4)*.2-.3,.5+Math.floor(i/4)*.06,-.2+Math.floor(i/4)*.2],[.24,.2,.24],a.hair);
  if(a.castId==='Amy')b(head,[.1,.05,-.45],[.23,.55,.25],a.hair);
  for(const x of [-.14,.14]) {
    b(head,[x,.23,.307],[.055,.065,.025],'#272a28');b(head,[x,.33,.307],[.13,.03,.025],a.hair);
    if(a.glasses){b(head,[x,.23,.329],[.23,.17,.035],'#394437');b(head,[x,.24,.351],[.15,.1,.02],a.skin);b(head,[x,.23,.365],[.045,.045,.01],'#272a28');}
  }
  if(a.glasses)b(head,[0,.24,.34],[.1,.035,.025],'#394437');
  b(head,[0,.11,.33],[.1,.1,.07],a.skin);b(head,[0,.02,.309],[.16,.035,.02],'#775541');
  for(const side of [-1,1]) {
    const arm=side<0?left:right,leg=side<0?leftLeg:rightLeg;
    b(arm,[0,-.21,.04],[.2,.43,.23],a.shirt);b(arm,[0,-.39,.27],[.2,.19,.43],a.shirt);b(arm,[0,-.38,.52],[.19,.16,.18],a.skin);
    b(leg,[0,-.1,pose==='seated'?.21:0],[.24,.23,pose==='seated'?.65:.25],'#37413e');
    b(leg,[0,pose==='seated'?-.45:-.42,pose==='seated'?.4:0],[.22,pose==='seated'?.6:.67,.23],'#37413e');
    b(leg,[0,-.71,pose==='seated'?.48:.08],[.27,.18,.38],'#242d2b');
  }
  return [{voxels:body,pivot:[0,0,0],axis:'none'},{voxels:head,pivot:[0,1.7,0],axis:'y'},
    {voxels:left,pivot:[-armX,1.4,0],axis:'x'},{voxels:right,pivot:[armX,1.4,0],axis:'x'},
    {voxels:leftLeg,pivot:[-.22,.85,0],axis:'x'},{voxels:rightLeg,pivot:[.22,.85,0],axis:'x'}];
}
