import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSharedOfficeModel, deriveSharedOfficeNotices, presentSession } from "../../src/office/model";
import { multiConversation, session as s, delegation as d, snapshot as snap } from "./fixtures";
import { agentOf } from "../../src/sessionAgent";

test("all conversations, standalone work and shared targets are counted once by role", () => {
  const m = deriveSharedOfficeModel(multiConversation());
  assert.equal(m.sessionIds.length, 8);
  assert.equal(new Set(m.sessionIds).size, 8);
  assert.equal(m.counts.working, 7);
  assert.equal(m.departments.find(d => d.agent === "coordinator")!.sessionIds.length, 3);
  assert.equal(m.sessionIds.filter(id => id === "shared").length, 1);
  assert.equal(m.departments.find(d => d.agent === "researcher")!.unfinished, 0);
  assert.ok(m.departments.some(d => d.agent === "designer"));
  assert.ok(m.departments.some(d => d.agent === "unassigned"));
  assert.equal(presentSession(s("custom", "designer")).verified, true);
});
test("no coordinator, cycles and missing ancestors do not exclude real sessions", () => {
  const m = deriveSharedOfficeModel(snap([s("x"), s("y"), s("orphan")], [
    d("xy", "x", "y"), d("yx", "y", "x"), d("mo", "missing", "orphan"),
    d("target", "x", "not-yet"),
  ]));
  assert.deepEqual(m.sessionIds, ["orphan", "x", "y"]);
  assert.equal(m.pendingAssignments[0].targetId, "not-yet");
  assert.ok(m.diagnostics.some(i => /cycl/i.test(i.message)));
  assert.ok(m.diagnostics.some(i => /missing|absent/i.test(i.message)));
  assert.equal(deriveSharedOfficeModel(snap()).counts.working, 0);
});
test("role activity, source verification and historical health stay independent", () => {
  const m = deriveSharedOfficeModel(snap([
    s("a", "coder", "working", { stale: true }), s("b", "coder", "needs_human"),
    s("c", "reviewer", "done", { stale: true }), s("u", "designer", "mystery"),
    s("n", "coder", "working", { registered: false }),
  ]));
  assert.equal(m.departments.find(d => d.agent === "coder")!.activity, "needs-human");
  assert.equal(m.departments.find(d => d.agent === "reviewer")!.activity, "idle");
  assert.equal(m.departments.find(d => d.agent === "designer")!.activity, "unknown");
  assert.equal(m.counts.healthIssues, 2);
  assert.equal(presentSession(s("n", "coder", "working", { registered: false })).verified, false);
  assert.equal(presentSession(s("n", "unknown")).verified, false);
});
test("shared attention and duplicate failed relationships yield stable global notices", () => {
  const snapshot = multiConversation();
  snapshot.sessions.find(s => s.sessionId === "shared")!.needs = [{ resolver: "human", text: "Choose" }];
  snapshot.sessions.find(s => s.sessionId === "shared")!.stale = true;
  snapshot.delegations.push(d("f", "absent-a", "absent-b", "failed"), d("f", "absent-a", "absent-b", "failed"));
  const m = deriveSharedOfficeModel(snapshot), notices = deriveSharedOfficeNotices(m);
  assert.equal(m.counts.failedHandoffs, 1);
  assert.equal(notices.filter(n => n.kind === "human").length, 1);
  assert.equal(notices.filter(n => n.kind === "health").length, 1);
  assert.equal(notices.find(n => n.kind === "handoff")!.sessionId, null);
  assert.deepEqual(deriveSharedOfficeNotices(deriveSharedOfficeModel({ ...snapshot, sessions: snapshot.sessions.toReversed(), delegations: snapshot.delegations.toReversed() })), notices);
});
test("graph agent normalization is shared without loading browser globals", () => {
  for (const agent of [undefined, "", "unknown"]) assert.equal(agentOf(s("x", "coder", "working", { agent })), "unassigned");
  assert.equal(agentOf(s("x", "designer")), "designer");
});
test("pending relationships with absent endpoints remain globally disclosed without a broken action", () => {
  const m = deriveSharedOfficeModel(snap([], [d("pending", "absent-a", "absent-b")]));
  const n = deriveSharedOfficeNotices(m);
  assert.equal(n.length, 1);
  assert.equal(n[0].sessionId, null);
  assert.match(n[0].label, /awaiting session record/);
  assert.equal(m.counts.failedHandoffs, 0);
});
