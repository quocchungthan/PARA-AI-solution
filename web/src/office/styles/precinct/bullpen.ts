import type {OfficeLayout} from '../../layout';
import type {PrecinctPalette} from './palette';
import {details} from './details';
import {PRECINCT_FIXTURES} from './fixtures';
export function buildBullpen(_layout:OfficeLayout,C:PrecinctPalette){const b=details(C);const {box,group,cylinder,ball,rod,ring,panel,furniture,walls,mug,book,papers,chair,monitor,phone,cabinet,desk,microwave,badgeTexture,flagTexture}=b;
for(const [i,f] of PRECINCT_FIXTURES.filter(f=>f.id.startsWith('bullpen-')).entries())desk(f.position[0],f.position[2],f.rotation,i,i!==2&&i!==5&&i!==7&&i!==8);
cabinet(furniture,22.8,8.8,.9,.75,1.42);cabinet(furniture,22.8,9.58,.9,.75,1.42);papers(furniture,22.8,1.47,8.8);box(furniture,23.48,1.65,10.5,.2,3.3,.2,'#b14c3b');cylinder(furniture,23.48,3.03,10.5,.2,.3,'#a94a39');

for(let z=7;z<=17.8;z+=.55)box(furniture,.05,.62,z,.09,1.1,.09,C.trim);box(furniture,.05,1.22,12.4,.2,.15,11.2,'#526264');box(furniture,.05,.15,12.4,.16,.15,11.2,C.trim);cabinet(furniture,.9,8.6,1.35,.85,1.3,C.wood);box(furniture,.9,1.55,8.6,1.05,.5,.8,'#bb9368');panel(furniture,.9,1.55,9.01,.23,.23,badgeTexture);


return b.geometry();}
