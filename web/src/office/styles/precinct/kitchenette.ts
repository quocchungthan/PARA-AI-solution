import type {OfficeLayout} from '../../layout';
import type {PrecinctPalette} from './palette';
import {details} from './details';
import {PRECINCT_FIXTURES} from './fixtures';
export function buildKitchenette(_layout:OfficeLayout,C:PrecinctPalette){const b=details(C);const {box,group,cylinder,ball,rod,ring,panel,furniture,walls,mug,book,papers,chair,monitor,phone,cabinet,desk,microwave,badgeTexture,flagTexture}=b;
const kitchen=group(.65,.85);box(kitchen,3.2,.64,.35,5.5,1.28,1.1,C.navy);box(kitchen,3.2,1.32,.35,5.7,.15,1.18,'#5b6261');box(kitchen,5.65,.65,1.25,1.1,1.3,1.8,C.navy);box(kitchen,5.65,1.33,1.25,1.17,.15,1.88,'#5b6261');box(kitchen,3.2,2.58,.14,5.6,1.08,.86,C.navy);box(kitchen,5.65,2.58,.65,1.1,1.08,1.88,C.navy);
for(let i=0;i<6;i++){box(kitchen,.65+i*.92,.65,.918,.82,1.15,.055,'#2d4055');box(kitchen,.94+i*.92,.87,.96,.05,.24,.055,'#929c98');box(kitchen,.65+i*.92,2.58,.593,.82,.96,.035,'#304258');box(kitchen,.94+i*.92,2.58,.63,.05,.22,.04,'#8b9692')}
box(kitchen,-.27,1.47,.48,1.45,2.94,1.38,'#d0d0be');box(kitchen,-.27,2.37,1.185,1.35,1.02,.05,'#dedccb');box(kitchen,-.27,.94,1.185,1.35,1.71,.05,'#d6d6c4');box(kitchen,-.7,2.3,1.24,.07,.3,.07,'#a4aaa0');box(kitchen,-.7,1.46,1.24,.07,.44,.07,'#a4aaa0');
microwave(kitchen,2.4,1.79,.36);cylinder(kitchen,4.1,1.56,.35,.23,.42,'#ece7d7');cylinder(kitchen,4.1,1.84,.35,.34,.08,'#e1e0ce');box(kitchen,1,3.34,.14,1.05,.55,.78,'#b98c60');box(kitchen,1,3.62,.14,1.12,.07,.83,'#a46f4e');panel(kitchen,1,3.32,.54,.25,.25,badgeTexture);cylinder(kitchen,2.48,3.38,.1,.19,.5,'#c6aa53');cylinder(kitchen,2.48,3.16,.1,.29,.1,'#bd9e48');for(const s of [-1,1])ring(kitchen,2.48+s*.22,3.45,.1,.2,.035,'#b99b48',[0,0,0]);cylinder(kitchen,3.4,3.34,.12,.16,.4,'#d2cbb9',.1);cylinder(kitchen,4.3,3.36,.13,.16,.44,'#3d7052',.1);cylinder(kitchen,4.3,3.66,.13,.065,.24,'#3d7052');for(let i=0;i<4;i++)cylinder(kitchen,5.35,3.16+i*.09,.25,.31,.07,'#e4dfd0');
const cafe=group(4.05,4.25);cylinder(cafe,0,.6,0,.12,1.2,'#8b9189');cylinder(cafe,0,.1,0,.59,.1,'#878e86');box(cafe,0,1.24,0,1.5,.13,1.22,'#8b6447');mug(cafe,-.34,1.31,-.06,'#d0ad37');mug(cafe,.35,1.31,.08,'#b44f3a');chair(cafe,-1.25,0,Math.PI/2,'#acb0a4');chair(cafe,1.25,0,-Math.PI/2,'#acb0a4');
box(furniture,7.35,1.825,3.1,.86,3.65,.86,C.brick);box(furniture,7.35,2.35,3.56,.42,.7,.04,'#ceac4e');for(let i=0;i<4;i++)box(furniture,7.35,2.5-i*.1,3.585,.26,.02,.01,'#675e40');cylinder(furniture,6.5,.53,4.1,.38,1.06,'#2b5880',.43);cylinder(furniture,6.5,1.067,4.1,.34,.015,'#193e60');box(furniture,8.02,.68,3.4,.65,1.36,.64,'#c7cbbb');box(furniture,8.02,.96,3.73,.36,.28,.02,'#566763');cylinder(furniture,8.02,1.72,3.4,.24,.7,'#729caa',.22);


return b.geometry();}
