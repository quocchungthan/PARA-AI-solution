import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFICE_LAYOUT } from "../../src/office/layout";
import { findRoute, isWalkable } from "../../src/office/routes";
test("seats are unique, reserved leads remain separate, all destinations route without obstacles", () => {
  const l = OFFICE_LAYOUT;
  assert.ok(
    l.walkGraph.nodes.length > 0,
    "Explicit circulation graph must be available to scene consumers",
  );
  assert.ok(l.walkGraph.edges.length > 0);
  assert.ok(l.seats.filter((s) => s.id.startsWith("team")).length >= 16);
  assert.equal(new Set(l.seats.map((s) => s.id)).size, l.seats.length);
  assert.equal(
    new Set(l.seats.map((s) => s.position.join(","))).size,
    l.seats.length,
  );
  for (const dest of [
    ...l.seats.map((s) => s.approach),
    ...l.loungeApproaches,
    ...Object.values(l.leads),
  ]) {
    const route = findRoute(l, l.entry, dest);
    assert.deepEqual(route[0], l.entry);
    assert.deepEqual(route.at(-1), dest);
    for (let i = 1; i < route.length; i++)
      for (let t = 0; t <= 1; t += 0.1) {
        const p: [number, number, number] = [
          route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t,
          0,
          route[i - 1][2] + (route[i][2] - route[i - 1][2]) * t,
        ];
        assert.ok(
          isWalkable(l, p),
          `Blocked route ${JSON.stringify(p)} to ${dest}`,
        );
      }
  }
});
test("lounge visits approach the sofa from the front without crossing its rendered backrest", () => {
  const l = OFFICE_LAYOUT;
  for (const origin of [l.leads.researcher, l.leads.coder])
    for (const seat of l.lounge) {
      const route = findRoute(l, origin, seat);
      assert.deepEqual(
        route.at(-2),
        [seat[0], 0, 7.5],
        "Seat only from the open front",
      );
      for (let i = 1; i < route.length; i++)
        for (let t = 0; t <= 1; t += 0.05) {
          const x = route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t;
          const z = route[i - 1][2] + (route[i][2] - route[i - 1][2]) * t;
          assert.ok(
            !(x > 10.55 && x < 13.95 && z > 5.69 && z < 6.01),
            "Route crosses rendered backrest",
          );
        }
      const returnRoute = findRoute(l, seat, origin);
      assert.deepEqual(returnRoute[1], [seat[0], 0, 7.5]);
    }
});
