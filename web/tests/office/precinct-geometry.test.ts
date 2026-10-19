import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PRECINCT_FIXTURES as fixtures} from '../../src/office/styles/precinct/fixtures';
import {getOfficeStyle} from '../../src/office/styles/registry';
import {buildPrecinctShell} from '../../src/office/styles/precinct/shell';
import {buildBullpen} from '../../src/office/styles/precinct/bullpen';
import {buildBreakRoom} from '../../src/office/styles/precinct/breakRoom';
import {buildKitchenette} from '../../src/office/styles/precinct/kitchenette';
import {buildOffices} from '../../src/office/styles/precinct/offices';
import {precinctPalette} from '../../src/office/styles/precinct/palette';
const l=getOfficeStyle('precinct').layout,p=precinctPalette('light');
test('floor surfaces cover the seven approved rooms without a bounding-box slab',()=>{
  const g=buildPrecinctShell(l,p,true);
  const slabs=g.boxes.filter(v=>v.position[1]<0);
  assert.deepEqual(slabs.map(v=>[v.position[0]-v.size[0]/2,v.position[2]-v.size[2]/2,v.size[0],v.size[2]].map(n=>Math.round(n*1e6)/1e6)),
    [[0,0,24,18],[0,18,7.4,7.3],[24,10,7.4,8],[24,3.2,7.4,6.8],[11,-6,13,6],[4,-5,7,5],[0,-5,4,5]]);
});
test('approved furniture orientation and collision footprints are shared with scene builders',()=>{
  assert.deepEqual(fixtures.find(f=>f.kind==='pool')?.position,[5.65,0,23.15]);
  assert.equal(fixtures.find(f=>f.kind==='pool')?.rotation,Math.PI/2);
  assert.equal(fixtures.filter(f=>f.kind==='vending').length,2);
  assert.equal(fixtures.filter(f=>f.id.startsWith('bullpen-')).length,9);
  for(const f of fixtures)assert.ok(l.obstacles.includes(f.footprint));
  const lounge=buildBreakRoom(l,p);
  assert.ok(lounge.boxes.some(v=>v.position[0]===5.65&&v.position[2]===23.15&&v.color==='#35674a'));
  assert.ok(buildBullpen(l,p).panels.some(v=>v.surface==='monitor'));
  assert.ok(buildKitchenette(l,p).boxes.some(v=>v.color===p.navy));
  assert.ok(buildOffices(l,p).panels.some(v=>v.surface==='flag'));
});
