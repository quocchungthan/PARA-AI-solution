import { test } from "node:test";
import assert from "node:assert/strict";
import { samplePath, sampleWorkPose } from "../../src/office/scene/motion";
test("movement follows each route segment without cutting corners", () => {
  const path = [
    [0, 0, 0],
    [4, 0, 0],
    [4, 0, 3],
  ] as const;
  assert.deepEqual(samplePath(path, 0, 2).position, path[0]);
  assert.deepEqual(samplePath(path, 2500, 2).position, [4, 0, 1]);
  assert.equal(samplePath(path, 3500, 2).done, true);
  assert.deepEqual(samplePath(path, 1, 2, true).position, path[2]);
});
test("repeated points and empty paths have finite headings; work gestures remain subtle", () => {
  assert.ok(
    Number.isFinite(
      samplePath(
        [
          [1, 0, 1],
          [1, 0, 1],
        ],
        5,
        2,
      ).heading,
    ),
  );
  assert.ok(Number.isFinite(samplePath([], 0, 2).heading));
  const p = sampleWorkPose("coder", 1000);
  assert.ok(Math.abs(p.head) < 0.2);
  assert.notEqual(p.leftArm, p.rightArm);
});
