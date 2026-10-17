import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOfficeModel } from "../../src/office/model";
import { session as s, delegation as d, snapshot as snap } from "./fixtures";
test("two roots retain nested delegated work on their own floors", () => {
  const m = deriveOfficeModel(
    snap(
      [
        s("a", "coordinator"),
        s("b", "coordinator"),
        s("c"),
        s("r", "reviewer"),
      ],
      [d("ac", "a", "c"), d("cr", "c", "r")],
    ),
  );
  assert.equal(m.floors.length, 2);
  assert.deepEqual(
    new Set(m.floors.find((f) => f.rootId === "a")!.sessionIds),
    new Set(["a", "c", "r"]),
  );
  assert.deepEqual(m.floors.find((f) => f.rootId === "b")!.sessionIds, ["b"]);
});
test("shared targets and duplicate edges retain one ID per floor; nested coordinator is not a floor", () => {
  const m = deriveOfficeModel(
    snap(
      [
        s("a", "coordinator"),
        s("b", "coordinator"),
        s("c", "coordinator"),
        s("w"),
      ],
      [d("1", "a", "c"), d("2", "c", "w"), d("3", "b", "w"), d("4", "a", "c")],
    ),
  );
  assert.deepEqual(
    m.floors.map((f) => f.rootId),
    ["a", "b"],
  );
  assert.equal(m.floors[0].sessionIds.filter((id) => id === "w").length, 1);
  assert.ok(m.floors[1].sessionIds.includes("w"));
});
test("cycles are quarantined; their descendants are not invented roots", () => {
  const m = deriveOfficeModel(
    snap(
      [s("a", "coordinator"), s("b", "coordinator"), s("c", "coordinator")],
      [d("1", "a", "b"), d("2", "b", "a"), d("3", "b", "c")],
    ),
  );
  assert.equal(m.floors.length, 0);
  assert.equal(m.ungrouped.length, 3);
  assert.match(m.ungrouped[0].reason, /cycl|ancestor/i);
});
test("missing parents, targets, unknown and unregistered records remain disclosed", () => {
  const m = deriveOfficeModel(
    snap(
      [
        s("a", "coordinator"),
        s("o"),
        s("u", "alien"),
        s("n", "coder", "working", { registered: false }),
      ],
      [
        d("1", "missing", "o"),
        d("2", "a", "u"),
        d("3", "a", "n"),
        d("4", "a", "not-yet"),
      ],
    ),
  );
  assert.deepEqual(m.floors[0].sessionIds, ["a", "n", "u"]);
  assert.equal(m.pendingAssignments[0].targetId, "not-yet");
  assert.equal(m.ungrouped.length, 3);
  assert.equal(m.sessionsById.has("not-yet"), false);
});
test("empty data, done root with active descendants, failed handoffs, and task title fallback", () => {
  assert.equal(deriveOfficeModel(snap()).floors.length, 0);
  const f = deriveOfficeModel(
    snap(
      [s("a", "coordinator", "done", { title: "  ", task: "My plan" }), s("w")],
      [d("1", "a", "w"), d("2", "a", "bad", "failed")],
    ),
  ).floors[0];
  assert.equal(f.active, true);
  assert.equal(f.title, "My plan");
  assert.equal(f.counts.failedHandoffs, 1);
});
