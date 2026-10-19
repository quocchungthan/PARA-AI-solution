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
  assert.equal(isWalkable(l, [8.8,0,-.1]), true, 'shared rear floor seam remains open');
});
