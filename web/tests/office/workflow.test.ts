import { test } from "node:test";
import assert from "node:assert/strict";
import { assignmentColumn, assignmentScope, linkedSessionTitle, sessionExecution, tasksInPhase } from "../../src/workflow";
import type { Assignment } from "../../src/store";
import { session } from "./fixtures";

test("task stages use explicit phases and never call an unregistered or legacy done session delivered", () => {
  const tasks = [
    session("old", "coder", "done"),
    session("unknown", "coordinator", "done", { phase: "delivered", registered: false }),
    session("local", "coordinator", "done", { phase: "delivered", result: "Local patch and acceptance checks complete" }),
    session("incomplete", "coordinator", "working", { phase: "delivered", result: "Still working" }),
    session("no-result", "coordinator", "done", { phase: "delivered" }),
    session("approval", "coordinator", "needs_human", { phase: "approval" }),
  ];
  assert.deepEqual(tasksInPhase(tasks, "delivered").map((s) => s.sessionId), ["local"]);
  assert.deepEqual(tasksInPhase(tasks, "approval").map((s) => s.sessionId), ["approval"]);
});

test("phase does not imply execution and canonical titles replace transport placeholders", () => {
  const worker = session("worker", "coder", "needs_human", {
    title: "Bridge message assignment:opaque", phase: "implementation",
    needs: [{ resolver: "human", text: "Access decision" }],
  });
  const a: Assignment = { key: "a", protocol: 2, originId: "origin", targetId: "worker",
    title: "Inventory caches", status: "assigned", workState: "needs_human",
    acceptance: [], dependsOn: [], writes: [], reports: [] };
  assert.equal(linkedSessionTitle(worker, [a]), "Inventory caches");
  assert.equal(sessionExecution(worker), "Needs your input");
  assert.equal(tasksInPhase([worker], "implementation").length, 1);
  assert.equal(assignmentColumn({ ...a, workState: "unexpected" }), "waiting");
  assert.equal(assignmentColumn({ ...a, workState: undefined }), "waiting");
  assert.match(assignmentScope(a), /Exclusive repository/);
  assert.match(assignmentScope({ ...a, accessMode: "read_only", reads: ["docs"] }), /Read-only scope: docs; no source writes/);
});
