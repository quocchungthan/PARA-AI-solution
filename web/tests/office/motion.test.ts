import { test } from "node:test";
import {idleAnimationWindow} from '../../src/office/scene/motion';
import assert from "node:assert/strict";
test('idle rendering wakes for bounded gestures with quiet time between them',()=>{
  assert.deepEqual(idleAnimationWindow(0,0),{active:false,wakeInMs:20000});
  assert.deepEqual(idleAnimationWindow(20000,0),{active:true,wakeInMs:4000});
  assert.deepEqual(idleAnimationWindow(24000,0),{active:false,wakeInMs:20000});
  assert.deepEqual(idleAnimationWindow(25000,0),{active:false,wakeInMs:19000});
});
import { samplePath, sampleWorkPose, sampleCharacterPose } from "../../src/office/scene/motion";
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
test("an idle office keeps moving between sips and stretches without typing", () => {
  const poses = Array.from({ length: 400 }, (_, i) =>
    sampleCharacterPose("coder", i * 100, { activity: "idle", rest: true, seed: 4 }),
  );
  assert.ok(poses.some((p) => p.action === "sip"));
  assert.ok(poses.some((p) => p.action === "stretch"));
  assert.ok(poses.every((p) => p.action !== "typing"));
  assert.ok(Math.max(...poses.map((p) => p.rightArm)) - Math.min(...poses.map((p) => p.rightArm)) > 0.8);
  assert.ok(Math.max(...poses.map((p) => p.breath)) - Math.min(...poses.map((p) => p.breath)) > 0.02);
  assert.notDeepEqual(
    sampleCharacterPose("coder", 1000, { activity: "idle", seed: 1 }),
    sampleCharacterPose("coder", 1000, { activity: "idle", seed: 9 }),
  );
});
test("desk waiting never types or sips, and walking takes priority over work and rest", () => {
  for (const activity of ["waiting", "blocked", "needs-human", "pending", "done", "unknown"]) {
    for (let t = 0; t < 30000; t += 500) {
      const p = sampleCharacterPose("reviewer", t, { activity, seed: 3 });
      assert.ok(p.action !== "typing" && p.action !== "sip");
    }
  }
  const walking = sampleCharacterPose("coder", 1000, { activity: "working", walking: true, rest: true });
  assert.equal(walking.action, "walk");
  assert.ok(Math.abs(walking.leftLeg) > 0.1);
  assert.equal(walking.leftLeg, -walking.rightLeg);
  const working = Array.from({ length: 60 }, (_, i) => sampleCharacterPose("coder", i * 100, { activity: "working" }));
  assert.ok(working.some((p) => p.action === "typing"));
  assert.ok(working.some((p) => p.action !== "typing"));
});
test("reduced motion and the human manager stay still through ambient and work cycles", () => {
  for (const options of [{ reducedMotion: true }, { human: true }]) {
    const first = sampleCharacterPose("coordinator", 0, { activity: "working", rest: true, walking: true, ...options });
    assert.equal(first.action, "still");
    for (const t of [100, 1000, 10000, 60000]) {
      assert.deepEqual(sampleCharacterPose("coordinator", t, { activity: "working", rest: true, walking: true, ...options }), first);
    }
    assert.equal(first.breath, 0);
    assert.equal(first.leftArm, 0);
    assert.equal(first.rightLeg, 0);
  }
});
