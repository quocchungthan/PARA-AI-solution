import { test } from "node:test";
import assert from "node:assert/strict";
import { describeActors } from "../../src/office/scene/Actors";
import { createSharedOfficeRuntime } from "../../src/office/runtime";
import { deriveSharedOfficeModel } from "../../src/office/model";
import { snapshot, session } from "./fixtures";

test("coordinator representative aggregates sessions while exact worker anchors cannot collide with it", () => {
  const model = deriveSharedOfficeModel(snapshot([session("assistant", "coordinator"), session("human", "coordinator", "needs_human")]));
  const runtime = createSharedOfficeRuntime(model, true, 0);
  const actors = describeActors({ runtime, model, theme: "light", reducedMotion: false, selection: null,
    cameraRef: { current: null }, onSelect() {}, onCameraChange() {}, onTick() {} });
  assert.equal(actors.length, 10);
  assert.equal(new Set(actors.map(a => a.id)).size, 10);
  const assistant = actors.find(a => a.id === "assistant")!;
  assert.deepEqual(assistant.selection, { kind: "department", agent: "coordinator" });
  assert.equal(assistant.status, "needs-human");
  const worker = actors.find(a => a.worker?.sessionId === "assistant")!;
  assert.notEqual(worker.id, assistant.id);
  assert.deepEqual(worker.selection, { kind: "session", sessionId: "assistant" });
});
