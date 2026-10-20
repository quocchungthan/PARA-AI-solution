import { test } from "node:test";
import assert from "node:assert/strict";
import { tasksInPhase } from "../../src/workflow";
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
