import { test } from "node:test";
import assert from "node:assert/strict";
import { createOfficeRuntime, reduceOffice } from "../../src/office/runtime";
import { deriveOfficeModel } from "../../src/office/model";
import { populated, session, delegation } from "./fixtures";
import { OFFICE_LAYOUT } from "../../src/office/layout";
import { pathDuration, workerPath } from "../../src/office/routes";
test("departure reports to real delegator, can resume, and disappearance never claims success", () => {
  const snap = populated(1);
  let r = createOfficeRuntime(deriveOfficeModel(snap), true, 0);
  snap.sessions[1].state = "done";
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 10,
  });
  r = reduceOffice(r, { type: "tick", nowMs: 1510 });
  let w = r.floors.get("main")!.workers[0];
  assert.equal(w.phase, "leaving");
  const route = workerPath(
    OFFICE_LAYOUT,
    w,
    r.model,
    "main",
    r.floors.get("main")!.workers,
  );
  assert.ok(
    route.some((p) => p.join() === OFFICE_LAYOUT.leads.coordinator.join()),
  );
  snap.sessions[1].state = "working";
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 1600,
  });
  assert.equal(r.floors.get("main")!.workers[0].phase, "seated");
  snap.sessions[1].state = "done";
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 2000,
  });
  r = reduceOffice(r, { type: "tick", nowMs: 3500 });
  r = reduceOffice(r, { type: "tick", nowMs: 3501 + pathDuration(route) });
  assert.equal(r.floors.get("main")!.workers.length, 0);
  snap.sessions.pop();
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 100000,
  });
  assert.equal(
    r.floors.get("main")!.queue.some((e) => e.kind === "leave"),
    false,
  );
});
test("capacity is ten; repeated and reordered snapshots preserve seats and all eleven tasks", () => {
  const snap = populated(11),
    m = deriveOfficeModel(snap),
    r = createOfficeRuntime(m, true, 0);
  const f = r.floors.get("main")!;
  assert.equal(f.workers.length, 10);
  assert.equal(m.floors[0].sessionIds.length, 12);
  const next = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel({
      ...snap,
      sessions: [...snap.sessions].reverse(),
    }),
    nowMs: 100,
  });
  assert.deepEqual(next.floors.get("main")!.workers, f.workers);
  const overflow = m.floors[0].sessionIds.find(
    (id) => id !== "main" && !f.workers.some((w) => w.sessionId === id),
  )!;
  const revealed = reduceOffice(r, {
    type: "revealWorker",
    floorId: "main",
    sessionId: overflow,
  });
  assert.equal(revealed.floors.get("main")!.workers.length, 10);
  assert.ok(
    revealed.floors.get("main")!.workers.some((w) => w.sessionId === overflow),
  );
  assert.equal(revealed.model.sessionsById.size, 12);
});
test("initial hydration is quiet, arrivals deduplicate, completion interrupts entry and reconnect hydrates", () => {
  const snap = populated(0);
  let r = createOfficeRuntime(deriveOfficeModel(snap), true, 0);
  assert.equal(r.floors.get("main")!.queue.length, 0);
  const next = populated(1);
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(next),
    nowMs: 10,
  });
  assert.equal(r.floors.get("main")!.workers[0].phase, "entering");
  assert.equal(
    r.floors.get("main")!.queue.filter((e) => e.kind === "arrive").length,
    1,
  );
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(next),
    nowMs: 20,
  });
  assert.equal(
    r.floors.get("main")!.queue.filter((e) => e.kind === "arrive").length,
    1,
  );
  next.sessions[1] = { ...next.sessions[1], state: "done" };
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(next),
    nowMs: 30,
  });
  assert.notEqual(r.floors.get("main")!.workers[0].phase, "entering");
  assert.equal(r.model.sessionsById.get("worker-0")!.state, "done");
  r = reduceOffice(r, { type: "connectivity", online: false, nowMs: 40 });
  next.sessions[1].state = "working";
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(next),
    nowMs: 5000,
  });
  r = reduceOffice(r, { type: "connectivity", online: true, nowMs: 5001 });
  assert.equal(r.floors.get("main")!.workers[0].phase, "seated");
  assert.equal(r.floors.get("main")!.queue.length, 0);
});
test("bursts bound transient actors; blocked source and full replacement remain truthful", () => {
  let r = createOfficeRuntime(deriveOfficeModel(populated(0)), true, 0);
  const snap = populated(11);
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 100,
  });
  assert.equal(
    r.floors.get("main")!.workers.filter((w) => w.phase === "entering").length,
    2,
  );
  snap.sessions[1].state = "blocked";
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 200,
  });
  assert.equal(
    r.floors.get("main")!.workers.find((w) => w.sessionId === "worker-0")!
      .phase,
    "seated",
  );
  snap.sessions[1].state = "done";
  snap.sessions.push(session("incoming"));
  snap.delegations.push(delegation("incoming", "main", "incoming"));
  r = reduceOffice(r, {
    type: "snapshot",
    model: deriveOfficeModel(snap),
    nowMs: 300,
  });
  assert.equal(r.floors.get("main")!.workers.length, 10);
});
