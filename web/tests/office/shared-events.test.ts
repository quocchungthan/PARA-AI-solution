import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSharedOfficeModel as model } from "../../src/office/model";
import { collectSharedOfficeEvents as events } from "../../src/office/events";
import { multiConversation, session, snapshot, delegation } from "./fixtures";

test("global hydration and repeated snapshots are quiet; standalone/coordinator arrivals are observed", () => {
  const a = model(snapshot());
  assert.deepEqual(events(null, a, 0), []);
  assert.deepEqual(events(a, a, 1), []);
  const b = model(snapshot([session("assistant", "coordinator"), session("solo")]));
  assert.deepEqual(events(a, b, 2).map(e => [e.kind, e.sessionId]), [["arrive", "assistant"], ["arrive", "solo"]]);
  assert.deepEqual(events(b, b, 3), []);
});
test("completion and result_fed report once to each actual valid parent across conversations", () => {
  const a = multiConversation(), b = structuredClone(a);
  b.sessions.find(s => s.sessionId === "shared")!.state = "done";
  b.delegations.find(d => d.key === "bs")!.status = "result_fed";
  b.delegations.push(delegation("failed", "standalone", "shared", "failed"));
  const reports = events(model(a), model(b), 2).filter(e => e.kind === "report");
  assert.deepEqual(reports.map(e => e.originId).sort(), ["b", "nested"]);
  assert.equal(new Set(reports.map(e => e.id)).size, 2);
});
test("result_fed never completes blocked work; missing endpoints and disappearance invent nothing", () => {
  const a = snapshot([session("p"), session("w", "coder", "blocked")], [delegation("pw", "p", "w")]);
  const b = structuredClone(a);
  b.delegations[0].status = "result_fed";
  assert.equal(events(model(a), model(b), 2)[0].kind, "report");
  assert.equal(model(b).sessionsById.get("w")!.state, "blocked");
  b.sessions.pop();
  b.delegations.push(delegation("missing", "p", "absent"));
  assert.deepEqual(events(model(a), model(b), 3), []);
});
