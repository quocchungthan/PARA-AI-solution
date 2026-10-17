import { test } from "node:test";
import assert from "node:assert/strict";
import { collectOfficeEvents } from "../../src/office/events";
import { deriveOfficeModel } from "../../src/office/model";
import { populated, snapshot, session, delegation } from "./fixtures";
test("observed transitions only: hydrate quiet; result_fed blocked is a report, never done", () => {
  const a = populated(1),
    before = deriveOfficeModel(a);
  assert.deepEqual(collectOfficeEvents(null, before, "main", 0), []);
  assert.deepEqual(collectOfficeEvents(before, before, "main", 1), []);
  const b = structuredClone(a);
  b.sessions[1].state = "blocked";
  b.delegations[0].status = "result_fed";
  const events = collectOfficeEvents(before, deriveOfficeModel(b), "main", 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "report");
  assert.equal(events[0].originId, "main");
});
test("completion reports follow successful delegators, once each, within the floor", () => {
  const a = snapshot(
    [
      session("main", "coordinator"),
      session("A"),
      session("B"),
      session("C"),
      session("W"),
    ],
    [
      delegation("ra", "main", "A"),
      delegation("rb", "main", "B"),
      delegation("rc", "main", "C"),
      delegation("failed", "A", "W", "failed"),
      delegation("valid", "B", "W"),
      delegation("duplicate", "B", "W"),
      delegation("shared", "C", "W"),
    ],
  );
  const b = structuredClone(a);
  b.sessions.find((s) => s.sessionId === "W")!.state = "done";
  b.delegations.find((d) => d.key === "valid")!.status = "result_fed";
  const reports = collectOfficeEvents(
    deriveOfficeModel(a),
    deriveOfficeModel(b),
    "main",
    2,
  ).filter((e) => e.kind === "report" && e.sessionId === "W");
  assert.deepEqual(reports.map((e) => e.originId).sort(), ["B", "C"]);
  assert.equal(new Set(reports.map((e) => e.id)).size, 2);
});
