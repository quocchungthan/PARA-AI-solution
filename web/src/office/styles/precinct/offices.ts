import type {OfficeLayout} from '../../layout';
import type {PrecinctPalette} from './palette';
import {details} from './details';
import {PRECINCT_FIXTURES} from './fixtures';
export function buildOffices(_layout:OfficeLayout,C:PrecinctPalette){const b=details(C);const {box,group,cylinder,ball,rod,ring,panel,furniture,walls,mug,book,papers,chair,monitor,phone,cabinet,desk,microwave,badgeTexture,flagTexture}=b;
const office=group(27.7,13.2,Math.PI/2);box(office,0,1.5,0,3.8,.18,1.65,'#76533b');for(const x of [-1.55,1.55])box(office,x,.7,0,.55,1.4,1.35,'#694a34');monitor(office,-.65,-.25);phone(office,.75,-.24,1.61);papers(office,.66,1.64,.42);mug(office,-1.25,1.61,.25,'#ddd9c8');chair(office,0,1.5,Math.PI,'#303e37');chair(office,-.9,-1.6,0,'#3e4b43');chair(office,1.0,-1.6,0,'#3e4b43');panel(office,1.35,1.9,-.48,.33,.35,badgeTexture);
const shelves=group(30.7,14);box(shelves,0,1.65,0,.6,3.3,6.4,'#6d4c36');for(let iz=0;iz<4;iz++){for(let iy=0;iy<3;iy++){const z=-2.45+iz*1.6,y=.53+iy*.96;box(shelves,-.34,y+.38,z,.12,.08,1.5,'#956f4b');for(let i=0;i<4;i++)box(shelves,-.4,y+.05,z-.5+i*.2,.12,.5+((i+iy)%2)*.14,.14,['#a99b62','#446b60','#995446','#b9b395'][(i+iz)%4])}}cylinder(shelves,-.45,2.78,-2.3,.17,.3,'#b39b4d');
panel(walls,27.1,2.5,10.15,1.3,.8,flagTexture);panel(walls,28.85,2.4,10.15,.64,.72,badgeTexture);
// Copier, filing and red utility pipe outside the office frontage.
cabinet(furniture,23.05,14.2,1.05,.8,1.48);box(furniture,23.05,1.72,14.2,1.1,.45,.84,'#bec1b2');box(furniture,22.9,1.96,14.1,.65,.08,.5,'#3d4c45');papers(furniture,23.05,1.98,14.24);cabinet(furniture,22.95,15.5,1.05,.9,1.48);box(furniture,23.45,1.65,16.3,.18,3.3,.18,'#b95441');


for(const f of PRECINCT_FIXTURES.filter(f=>f.id.startsWith('briefing-')||f.id==='research-desk'||f.id==='rear-desk'||f.id==='side-desk')) {
 if(f.id==='side-desk')desk(f.position[0],f.position[2],f.rotation,9);else {
  box(furniture,f.position[0],.9,f.position[2],f.footprint.width,.12,f.footprint.depth,C.dark);
  for(const s of [-1,1])box(furniture,f.position[0]+s*(f.footprint.width/2-.1),.44,f.position[2],.08,.88,.5,C.metal);
 }
}
for(const s of _layout.seats.filter(s=>!s.id.startsWith('bullpen-')&&s.id!=='side-desk'))chair(furniture,s.position[0],s.position[2],s.rotation,'#465565');
box(furniture,17.5,2,-5.73,4.6,1.7,.12,'#2e4845');

return b.geometry();}
