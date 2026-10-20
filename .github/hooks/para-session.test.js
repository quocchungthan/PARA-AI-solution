// Isolated tests: every hook subprocess points at a temporary data directory, never a live Bridge.
// Run: node --test .github/hooks/para-session.test.js (built-in modules only).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const hook = path.join(__dirname, "para-session.js");
const sessionId = "11111111-2222-4333-8444-555555555555";
const assignmentId = `${sessionId}:out:self-1`;
const request = () => ({
  id: "self-1",
  kind: "request",
  title: "Bounded hook change",
  prompt: "Approved hook-only change; verify in isolation; no publishing.",
  points: 2,
  mode: "self",
  acceptance: ["Isolated tests pass"],
  dependsOn: [],
  writes: [".github/hooks/para-session.js"],
  approvalRef: "Explicit user approval of bounded hook scope",
});
const session = (overrides = {}) => ({
  sessionId,
  agent: "unknown",
  task: "Bounded hook change",
  phase: "analysis",
  state: "waiting_input",
  estimate: { points: 2, rationale: "One bounded interface and isolated verification" },
  needs: [{ text: "Awaiting grant", resolver: "ai" }],
  question: "Has the Bridge granted this request?",
  outbox: [],
  progress: [],
  ...overrides,
});

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "para-hook-test-"));
  const dir = path.join(cwd, "data", "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.json`);
  // Sentinel files prove the hook never writes another session or bridge/inbox state.
  const sentinels = [
    path.join(dir, "other.json"),
    path.join(cwd, "data", "bridge", "state.json"),
    path.join(cwd, "data", "inbox", `${sessionId}.json`),
  ];
  for (const sentinel of sentinels) {
    fs.mkdirSync(path.dirname(sentinel), { recursive: true });
    fs.writeFileSync(sentinel, "DO NOT TOUCH");
  }
  t.after(() => {
    try {
      for (const sentinel of sentinels) assert.equal(fs.readFileSync(sentinel, "utf8"), "DO NOT TOUCH");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
  return {
    file,
    write(value) { fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); },
    run(event, extra = {}) {
      const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
      const result = spawnSync(process.execPath, [hook, event], {
        input: JSON.stringify({ cwd, sessionId, ...extra }),
        encoding: "utf8",
        timeout: 10000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      if (event === "stop" || before !== null) {
        if (before === null) assert.equal(fs.existsSync(file), false);
        else assert.deepEqual(fs.readFileSync(file), before, "hook must not rewrite existing data");
      }
      return result.stdout.trim() ? JSON.parse(result.stdout) : null;
    },
  };
}

test("default unknown startup supplies universal sizing, approval and bounded waiting guidance", (t) => {
  const f = fixture(t);
  const output = f.run("start", { initialPrompt: "A new task" });
  const stub = JSON.parse(fs.readFileSync(f.file, "utf8"));
  assert.equal(stub.agent, "unknown");
  assert.equal(stub.task, "A new task");
  assert.equal(stub.state, "working");
  assert.equal(stub.phase, "analysis");
  assert.deepEqual(stub.outbox, []);
  for (const phrase of [
    "default Copilot CLI", "unknown/unassigned", "estimate", "relative complexity",
    "NOT an approval exemption", "without a Bridge grant", "dependencies", "approvalRef",
    "immutable", "OutboxReceipts", "YIELDS", "no LLM busy polling",
    "Do not submit self requests", "Human needs", "Never automatically open a PR",
  ]) assert.ok(output.additionalContext.includes(phrase), phrase);
  assert.match(f.run("stop").reason, /missing estimate/);
});

test("independent approved CLI can finish without an outbox or Bridge grant", (t) => {
  const f = fixture(t);
  f.write(session({ phase: "delivered", state: "done", needs: [], question: null,
    result: "Approved direct work completed offline; no managed assignment." }));
  assert.equal(f.run("stop"), null);
});

test("explicit read-only scope accepts relative reads and rejects contradictory writes", (t) => {
  const f = fixture(t);
  const r = { ...request(), mode: "new", accessMode: "read_only", reads: ["docs"], writes: [] };
  f.write(session({ outbox: [r] }));
  assert.equal(f.run("stop"), null);
  for (const invalid of [{ writes: ["src"] }, { reads: ["../escape"] }, { accessMode: "read" }]) {
    f.write(session({ outbox: [{ ...r, ...invalid }] }));
    assert.match(f.run("stop").reason, /malformed access scope/);
  }
});

test("startup preserves an existing approved task and malformed existing file byte-for-byte", (t) => {
  const f = fixture(t);
  f.write(session({ phase: "implementation", work: assignmentId, outbox: [request()] }));
  assert.ok(f.run("start").additionalContext);
  f.write("{broken original\n");
  assert.ok(f.run("start").additionalContext);
});

test("stop blocks stale working state once, and stop_hook_active always yields", (t) => {
  const f = fixture(t);
  f.write(session({ state: "working" }));
  assert.match(f.run("stop").reason, /still "working"/);
  assert.equal(f.run("stop", { stop_hook_active: true }), null);
  f.write("{bad JSON");
  assert.equal(f.run("stop", { stop_hook_active: true }), null);
});

test("missing estimate blocks visibly new work, including a parked request", (t) => {
  const f = fixture(t);
  const value = session({ phase: "implementation", state: "done" });
  delete value.estimate;
  f.write(value);
  assert.match(f.run("stop").reason, /missing estimate/);
  f.write({ ...value, phase: "analysis", state: "pending", outbox: [request()] });
  assert.match(f.run("stop").reason, /missing estimate/);
  f.run("start"); // Existing data is still preserved.
});

test("legacy waiting/done files without new-task signals are not trapped", (t) => {
  const f = fixture(t);
  for (const state of ["waiting_input", "done"]) {
    f.write({ sessionId, state, handoff: null });
    assert.equal(f.run("stop"), null);
  }
});

test("human source/analysis/approval wait can yield before an estimate without faking approval", (t) => {
  const f = fixture(t);
  for (const phase of ["analysis", "approval"]) {
    const value = session({
      phase, state: "needs_human",
      needs: [{ resolver: "human", text: "Source or implementation approval needed" }],
      question: "Should PARA implement this bounded scope?",
    });
    delete value.estimate;
    f.write(value);
    assert.equal(f.run("stop"), null);
  }
  const value = session({ state: "waiting_input", question: "Which source should I analyze?" });
  delete value.estimate;
  f.write(value);
  assert.equal(f.run("stop"), null);
});

test("human needs must retain the human gate and a precise question", (t) => {
  const f = fixture(t);
  const value = session({ needs: [{ resolver: "human", text: "Approval required" }] });
  f.write(value);
  assert.match(f.run("stop").reason, /unresolved human need/);
  f.write({ ...value, state: "needs_human" });
  assert.equal(f.run("stop"), null);
  f.write({ ...value, state: "needs_human", question: null });
  assert.match(f.run("stop").reason, /precise question/);
});

test("valid waiting/pending with estimate and inherited approved running assignment can yield", (t) => {
  const f = fixture(t);
  for (const state of ["waiting_input", "pending", "blocked"]) {
    f.write(session({ state, outbox: [request()] }));
    assert.equal(f.run("stop"), null);
  }
  f.write(session({
    phase: "delivered", state: "done", work: assignmentId,
    result: "Inherited approved task completed and tested locally.",
    outbox: [{
      id: "done-1", kind: "report", assignmentId, reportKind: "done",
      summary: "Verified inherited scope", evidence: ["hook test: passed"],
      verification: "node --test", question: "None remaining",
    }],
  }));
  assert.equal(f.run("stop"), null); // No second approval or self request required.
});

test("malformed/missing JSON is blocked without replacement or repair", (t) => {
  const f = fixture(t);
  assert.match(f.run("stop").reason, /missing or invalid session JSON/);
  for (const raw of ["{", "null", "[]", "true"]) {
    f.write(raw);
    assert.equal(f.run("stop").decision, "block");
  }
  f.write("\uFEFF" + JSON.stringify(session()));
  assert.equal(f.run("stop"), null);
});

test("malformed estimates and structural fields are rejected, larger parent estimate is allowed", (t) => {
  const f = fixture(t);
  for (const estimate of [null, 0, {}, { points: 0, rationale: "bad" },
    { points: 1.5, rationale: "bad" }, { points: "2", rationale: "bad" },
    { points: 2, rationale: "" }]) {
    f.write(session({ estimate }));
    assert.match(f.run("stop").reason, /malformed estimate/);
  }
  for (const invalid of [{ work: null }, { needs: {} }, { question: 1 }, { phase: "magic" }]) {
    f.write(session(invalid));
    assert.equal(f.run("stop").decision, "block");
  }
  f.write(session({ estimate: { points: 5, rationale: "Parent decomposes work" } }));
  assert.equal(f.run("stop"), null);
});

test("outbox rejects bad shapes, IDs, unsupported messages and overflow", (t) => {
  const f = fixture(t);
  for (const outbox of [
    null, {}, [null], [request(), request()], [{ ...request(), id: "" }],
    [{ id: "message-1", kind: "message", prompt: "Invented existing-target message" }],
    Array.from({ length: 51 }, (_, i) => ({ ...request(), id: `req-${i}` })),
  ]) {
    f.write(session({ outbox }));
    assert.match(f.run("stop").reason, /malformed outbox/);
  }
  f.write(session({ outbox: Array.from({ length: 50 }, (_, i) => ({ ...request(), id: `req-${i}` })) }));
  assert.equal(f.run("stop"), null);
});

test("request validation checks shape and relative writes, not dependency or approval semantics", (t) => {
  const f = fixture(t);
  for (const invalid of [
    { points: 3 }, { mode: "existing" }, { acceptance: "test" }, { dependsOn: [1] },
    { approvalRef: "" }, { writes: ["../escape"] }, { writes: ["C:/escape"] },
    { writes: ["/escape"] }, { writes: ["src/**"] }, { writes: ["src/../escape"] },
    { writes: ["\\\\server\\share"] }, { agent: "" },
  ]) {
    f.write(session({ outbox: [{ ...request(), ...invalid }] }));
    assert.match(f.run("stop").reason, /malformed outbox request/);
  }
  for (const writes of [[], [".github/hooks"], [".github/hooks/"]]) {
    // Unknown/cyclic deps and approval authenticity belong to Bridge/human policy, not the hook.
    f.write(session({ outbox: [{ ...request(), writes, dependsOn: ["unknown"], approvalRef: "opaque reference" }] }));
    assert.equal(f.run("stop"), null);
  }
});

test("sibling new-worker requests with forward dependencies and explicit agent pass shape checks", (t) => {
  const f = fixture(t);
  f.write(session({
    estimate: { points: 5, rationale: "Parent fans out bounded siblings" },
    outbox: [
      { ...request(), id: "review", mode: "new", agent: "reviewer", dependsOn: ["change"] },
      { ...request(), id: "change", mode: "new", agent: "coder" },
    ],
  }));
  assert.equal(f.run("stop"), null);
});

test("reports and cancellation validate only structure, not ownership or completion semantics", (t) => {
  const f = fixture(t);
  const report = {
    id: "report-1", kind: "report", assignmentId,
    reportKind: "waiting", summary: "Awaiting dependency", evidence: [],
  };
  for (const reportKind of ["progress", "waiting", "blocked", "needs_human", "done", "failed"]) {
    f.write(session({ outbox: [{ ...report, reportKind, question: "Which prerequisite is missing?" }] }));
    assert.equal(f.run("stop"), null);
  }
  for (const invalid of [
    { reportKind: "cancelled" }, { assignmentId: "" }, { evidence: "proof" },
    { verification: 1 }, { question: 1 }, { question: "" }, { question: " " },
  ]) {
    f.write(session({ outbox: [{ ...report, ...invalid }] }));
    assert.match(f.run("stop").reason, /malformed outbox report/);
  }
  f.write(session({ outbox: [{ id: "cancel-1", kind: "cancel", assignmentId, summary: "Request cancellation" }] }));
  assert.equal(f.run("stop"), null);
  f.write(session({ outbox: [{ id: "cancel-1", kind: "cancel", assignmentId }] }));
  assert.match(f.run("stop").reason, /malformed outbox cancel/);
});

test("optional report questions accept null without rewriting immutable reports", (t) => {
  const f = fixture(t);
  for (const reportKind of ["progress", "waiting", "blocked", "done", "failed"]) {
    for (const optional of [{}, { question: null }, { question: "Review this observation?" }]) {
      f.write(session({ outbox: [{
        id: "report-1", kind: "report", assignmentId, reportKind,
        summary: "Observed result", evidence: ["Observed evidence"], verification: "passed", ...optional,
      }] }));
      assert.equal(f.run("stop"), null);
    }
  }
  for (const optional of [{}, { question: null }, { question: "" }, { question: " " }]) {
    f.write(session({ outbox: [{
      id: "report-1", kind: "report", assignmentId, reportKind: "needs_human",
      summary: "Human decision required", evidence: [], ...optional,
    }] }));
    assert.match(f.run("stop").reason, /malformed outbox report/);
  }
});

test("unsafe session IDs cannot address another file", (t) => {
  const f = fixture(t);
  assert.equal(f.run("start", { sessionId: "../escape" }), null);
  assert.equal(fs.existsSync(f.file), false);
  assert.equal(f.run("stop", { sessionId: "C:\\escape" }), null);
});

const readInstruction = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("T5.1: persistent global/protocol contract and JSON examples are consistent", () => {
  const read = readInstruction;
  const global = read("copilot-instructions.md");
  const skill = read("skills/para-session-protocol/SKILL.md");
  for (const phrase of [
    "Protocol: 2", "Delegations", "OutboxReceipts", "payloadHash", "RootKey", "ParentKey",
    "recovery_required", "same origin session", "atomically", "exclusive repository",
    "50 entries", "approvalRef", "at-least-once", "running/uncertain", "creator only",
    "Legacy", "attempts >= 3", "BREAKPOINT", "self-resume",
  ]) assert.ok(skill.includes(phrase), `skill contract: ${phrase}`);
  assert.ok(global.includes("unknown and unassigned"));
  assert.ok(global.includes("NEVER write"));
  for (const match of skill.matchAll(/```json\n([\s\S]*?)\n```/g)) assert.doesNotThrow(() => JSON.parse(match[1]));
});

test("T5.2: all seven roles retain focus and remove direct inbox/handoff exceptions", () => {
  const read = readInstruction;
  for (const role of ["coder", "coordinator", "functional-reviewer", "hr", "researcher", "reviewer", "scrum-master"]) {
    const body = read(`agents/${role}.agent.md`);
    assert.match(body, /without a Bridge grant/i, `${role}: independent execution`);
    assert.match(body, /(?:never|not) submit (?:new )?self requests/i, `${role}: no self trap`);
    assert.match(body, /report/i, `${role}: owned assignment reporting`);
    assert.doesNotMatch(body, /append pending messages|add a message to `data\/inbox|write a `handoff`/);
  }
  const scrum = read("agents/scrum-master.agent.md");
  assert.ok(scrum.includes("There is no scrum-master exception"));
  assert.ok(scrum.includes("message commands are not supported"));
  assert.ok(read("agents/researcher.agent.md").includes("do not modify source files"));
  assert.ok(read("agents/reviewer.agent.md").includes("accessMode: read_only"));
  assert.ok(read("agents/functional-reviewer.agent.md").includes("Playwright"));
});
