import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOfficeStyle } from '../../src/office/styles/registry';
import { findRoute, isWalkable, distance } from '../../src/office/routes';
import type { Vec3 } from '../../src/office/types';

for (const id of ['botanical', 'precinct'] as const) {
  test(`${id} has distinct seats and navigable capacity for all roles and ten workers`, () => {
    const l = getOfficeStyle(id).layout;
    assert.equal(new Set(l.seats.map(s => s.id)).size, l.seats.length);
    assert.equal(new Set(l.seats.map(s => s.position.join())).size, l.seats.length);
    assert.equal(l.seats.filter(s => s.reservedFor).length, 7);
    assert.equal(new Set(l.seats.filter(s => s.reservedFor).map(s => s.reservedFor)).size, 7);
    assert.ok(l.seats.filter(s => !s.reservedFor).length >= 10);
    assert.ok(!l.seats.some(s => s.position.join() === l.human.join()));
    for (const dest of [...l.seats.map(s => s.approach), ...l.restSeats.map(s => s.approach), ...Object.values(l.leads), l.human]) {
      const path = findRoute(l, l.entry, dest);
      assert.deepEqual(path[0], l.entry);
      assert.deepEqual(path.at(-1), dest);
      for (let i = 1; i < path.length; i++) {
        const a = path[i-1], b = path[i], n = Math.max(1, Math.ceil(distance(a,b) / .1));
        for (let j = 0; j <= n; j++) {
          const p: Vec3 = [a[0]+(b[0]-a[0])*j/n,0,a[2]+(b[2]-a[2])*j/n];
          assert.ok(isWalkable(l,p), `${id}: blocked ${p} toward ${dest}`);
        }
      }
    }
  });
  test(`${id} approaches rest seats from their explicit open side in both directions`, () => {
    const l = getOfficeStyle(id).layout;
    for (const seat of l.restSeats) {
      assert.deepEqual(findRoute(l, l.entry, seat.position).at(-2), seat.approach);
      assert.deepEqual(findRoute(l, seat.position, l.entry)[1], seat.approach);
    }
  });
}
test('precinct excludes the void beside the projecting lounge', () => {
  const l = getOfficeStyle('precinct').layout;
  assert.equal(isWalkable(l, [15,0,23]), false);
  assert.equal(isWalkable(l, [9,0,-.1]), true, 'shared rear floor seam remains open');
});
test('precinct rest routes clear the rendered water dispenser and kitchenette pillar',()=>{
  const l=getOfficeStyle('precinct').layout;
  // Independently measured from the approved modeled props, including clearance.
  const solids=[{x:6.305,z:18.075,width:1.05,depth:1.05},{x:6.72,z:2.47,width:1.26,depth:1.26},
    {x:7.495,z:2.88,width:1.05,depth:1.04},{x:5.87,z:3.47,width:1.26,depth:1.26}];
  for(const target of [...l.restSeats.map(s=>s.position),...Object.values(l.leads)]) {
    const route=findRoute(l,l.entry,target);
    for(let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i],n=Math.max(1,Math.ceil(distance(a,b)/.1));
      for(let j=0;j<=n;j++) {
        const x=a[0]+(b[0]-a[0])*j/n,z=a[2]+(b[2]-a[2])*j/n;
        assert.ok(!solids.some(r=>x>r.x&&x<r.x+r.width&&z>r.z&&z<r.z+r.depth),`Route crosses rendered prop at ${x},${z}`);
      }
    }
  }
});
