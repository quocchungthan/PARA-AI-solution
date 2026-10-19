import type {OfficeLayout} from '../../layout';
import type {PrecinctPalette} from './palette';
import {createPrecinctBuilder} from './primitives';
export function buildPrecinctShell(layout:OfficeLayout,C:PrecinctPalette,cutaway:boolean) {
  const b=createPrecinctBuilder(C),{box,panel,furniture:g}=b;
  for(const [index,r] of layout.floorAreas.entries()) {
    const dark=index===1||index===2;
    box(g,r.x+r.width/2,-.13,r.z+r.depth/2,r.width,.26,r.depth,dark?'#5c6461':'#a6ab9b');
    for(let ix=0;ix<Math.ceil(r.width/.72);ix++)for(let iz=0;iz<Math.ceil(r.depth/.72);iz++) {
      const w=Math.min(.72,r.width-ix*.72)-.012,d=Math.min(.72,r.depth-iz*.72)-.012,k=(ix*13+iz*17)%37;
      const color=dark?['#555d59','#59605b','#535c56'][(ix+iz)%3]:k<3?'#b4bab1':k<6?'#cda87d':k===9?'#c6bba1':C.tile;
      box(g,r.x+ix*.72+w/2,.016,r.z+iz*.72+d/2,w,.035,d,color);
    }
  }
  for(const wall of layout.walls) {
    const height=cutaway?wall.cutawayHeight:wall.height,x=(wall.from[0]+wall.to[0])/2,z=(wall.from[2]+wall.to[2])/2;
    const w=Math.abs(wall.to[0]-wall.from[0])+.22,d=Math.abs(wall.to[2]-wall.from[2])+.22;
    box(g,x,height/2,z,w,height,d,C.cream);box(g,x,.14,z,w+.025,.22,d+.025,'#5c665e');
    box(g,x,height+.06,z,w+.045,.13,d+.045,'#e8ddb9');
    for(let y=.35;y<height;y+=.39)box(g,x,y,z+d/2+.005,w,.012,.008,'#c7bc97');
  }
  // Window frames and transparent panes retain the cutaway sight line.
  for(const [x,z,w,angle] of [[12.8,0,5,0],[21,0,4.8,0],[24,5.1,3.4,Math.PI/2],[24,10.9,1.6,Math.PI/2],[24,16.2,3,Math.PI/2],[2.6,18,5.05,0]]) {
    const q=b.group(x,z,angle),height=cutaway?1.1:3.05;
    for(const s of [-1,1])box(q,s*w/2,height/2,0,.09,height,.16,C.trim);
    for(const y of [.15,height])box(q,0,y,0,w,.09,.16,C.trim);
    for(let i=1;i<3;i++)box(q,-w/2+i*w/3,height/2,0,.055,height,.1,C.trim);
    panel(q,0,height/2,0,w-.13,height-.16,'glass');
  }
  for(const [x,z] of [[0,0],[0,5.1],[8.3,0],[11,0],[24,0],[24,10],[24,18],[31.4,10],[31.4,18],[0,18],[7.4,18],[7.35,3.1]]) {
    const h=cutaway&&(z>=18||x===0)?1.1:3.3;
    box(g,x,h/2,z,.65,h,.65,C.brick);
    for(let row=0;row<Math.floor(h/.32);row++) {
      const y=.18+row*.32;box(g,x,y,z+.334,.65,.018,.012,'#697e86');
      box(g,x+.334,y,z,.012,.018,.65,'#697e86');
      box(g,x+(row%2?.13:-.16),y+.15,z+.337,.016,.28,.016,'#697e86');
    }
  }
  return b.geometry();
}
