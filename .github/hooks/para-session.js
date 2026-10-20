// Cooperative protocol reminder and structural stop checks, NOT approval/ownership enforcement.
const fs = require("fs");
const path = require("path");

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const texts = (value) => Array.isArray(value) && value.every(text);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const states = ["working", "waiting_input", "pending", "blocked", "needs_human", "done"];
const reportKinds = ["progress", "waiting", "blocked", "needs_human", "done", "failed"];
const phases = ["analysis", "approval", "implementation", "review", "delivered", "declined"];

function writeScope(value) {
  return text(value) &&
    !path.posix.isAbsolute(value) &&
    !path.win32.isAbsolute(value) &&
    !/[\\:*?[\]{}]/.test(value) &&
    !value.replace(/\/$/, "").split("/").some((part) => part === ".." || part === "." || part === "");
}

// Shape only: Bridge owns dependency graphs, immutable receipts and row ownership; approval is cooperative.
function structuralError(session) {
  if (!object(session) || !states.includes(session.state)) return "missing or invalid session state";
  if (owns(session, "phase") && !phases.includes(session.phase)) return "invalid phase";
  if (owns(session, "estimate") &&
      (!object(session.estimate) || !Number.isSafeInteger(session.estimate.points) ||
       session.estimate.points < 1 || !text(session.estimate.rationale))) {
    return "malformed estimate: use positive integer points and a nonempty rationale";
  }
  if (owns(session, "work") && !text(session.work)) return "malformed work: use a Bridge-granted assignment ID";
  if (owns(session, "needs") &&
      (!Array.isArray(session.needs) || !session.needs.every((need) =>
        object(need) && text(need.text) && ["ai", "human"].includes(need.resolver)))) {
    return "malformed needs";
  }
  if (owns(session, "question") && session.question !== null && !text(session.question)) {
    return "malformed question";
  }
  if (owns(session, "outbox")) {
    if (!Array.isArray(session.outbox) || session.outbox.length > 50) return "malformed outbox: array, max 50 entries";
    const ids = new Set();
    for (const item of session.outbox) {
      if (!object(item) || !text(item.id) || ids.has(item.id)) return "malformed outbox: unique nonempty command IDs required";
      ids.add(item.id);
      if (item.kind === "request") {
        if ((owns(item, "accessMode") && !["read_only", "write"].includes(item.accessMode)) ||
            (owns(item, "reads") && (!Array.isArray(item.reads) || !item.reads.every(writeScope))) ||
            (item.accessMode === "read_only" && (!Array.isArray(item.writes) || item.writes.length > 0))) {
          return "malformed access scope: read_only/write, exact relative reads; read_only requires empty writes";
        }
        if (!text(item.title) || !text(item.prompt) || ![1, 2].includes(item.points) ||
            !["self", "new"].includes(item.mode) || !texts(item.acceptance) ||
            !texts(item.dependsOn) || !Array.isArray(item.writes) || !item.writes.every(writeScope) ||
            !text(item.approvalRef) || (owns(item, "agent") && !text(item.agent))) {
          return "malformed outbox request: require 1–2 points, self/new, acceptance, same-origin dependsOn, exact relative writes and approvalRef";
        }
      } else if (item.kind === "report") {
        if (!text(item.assignmentId) || !reportKinds.includes(item.reportKind) ||
            !text(item.summary) || !texts(item.evidence) ||
            (owns(item, "verification") && !text(item.verification)) ||
            (owns(item, "question") && item.question !== null && !text(item.question)) ||
            (item.reportKind === "needs_human" && !text(item.question))) {
          return "malformed outbox report";
        }
      } else if (item.kind === "cancel") {
        if (!text(item.assignmentId) || !text(item.summary)) return "malformed outbox cancel";
      } else {
        return "malformed outbox: supported kinds are request/report/cancel, not messages";
      }
    }
  }

  const humanNeed = (session.needs || []).some((need) => need.resolver === "human");
  if (humanNeed && (session.state !== "needs_human" || !text(session.question))) {
    return "unresolved human need: set needs_human and one precise question, then stop";
  }
  // Do not trap legacy files or intake waiting for a source/approval before material analysis.
  // Missing-estimate detection is only a visible new-task signal, not proof of a task boundary.
  const intakeWait = ["analysis", "approval", undefined].includes(session.phase) &&
    ["pending", "waiting_input", "needs_human"].includes(session.state) && text(session.question) &&
    !owns(session, "work") && (session.outbox || []).length === 0;
  const newTask = owns(session, "phase") || owns(session, "work") ||
    (session.outbox || []).length > 0 ||
    (Array.isArray(session.progress) && session.progress.some((entry) =>
      object(entry) && entry.note === "Stub created by sessionStart hook"));
  if (newTask && !owns(session, "estimate") && !intakeWait) {
    return "missing estimate for a new task: record {points, rationale} before material analysis, delegation or coding";
  }
  if (session.state === "working") return 'still "working": update progress/state/result or question/needs before ending';
  return null;
}

const event = process.argv[2];
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {}
  const sessionId = input && input.sessionId;
  // Never allow a hook payload to address files outside the caller's session directory.
  if (typeof sessionId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(sessionId)) return;

  const dir = path.join(input.cwd || process.cwd(), "data", "sessions");
  const file = path.join(dir, `${sessionId}.json`);
  const now = new Date().toISOString();

  if (event === "start") {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            sessionId,
            agent: "unknown",
            title: "(not yet described)",
            taskType: "other",
            task: input.initialPrompt || "(fill in)",
            phase: "analysis",
            state: "working",
            outbox: [],
            needs: [],
            question: null,
            attempts: 0,
            progress: [{ ts: now, note: "Stub created by sessionStart hook" }],
            result: null,
            handoff: null,
            updatedAt: now,
          },
          null,
          2
        ),
        { flag: "wx" }
      );
    }
    console.log(
      JSON.stringify({
        additionalContext: `PARA protocol applies to every named/custom/default Copilot CLI session, including unknown/unassigned. Your file is data/sessions/${sessionId}.json; preserve existing data. Follow para-session-protocol. Record estimate {points,rationale} before material work; relative complexity, not time. Analyze and obtain exact bounded approval; smallness is NOT an approval exemption. Independent approved CLI work executes directly without a Bridge grant, even if the Bridge is offline. Do not submit self requests. Bridge orchestration is opt-in: use mode new for autonomous managed workers, with dependencies, reads/writes, acceptance and approvalRef. Existing assigned workers require owned running grants; never bypass running/uncertain ownership. Old ungranted self requests must be cancelled by their creator before direct execution or a new managed request; never amend immutable payloads. Read-only managed work uses accessMode read_only, relative reads and empty writes; omitted accessMode preserves legacy exclusive Writes=[]. Ask source if absent. Use append-only outbox request/report/cancel (max50, immutable IDs), not scalar handoffs. Bridge owns Protocol 2 Delegations/OutboxReceipts and inbox; never write bridge/inbox/other sessions. No SDK self-resume or duplicate processes. Supervisors publish siblings once, wait with an AI need/question and YIELDS; no LLM busy polling. Attended CLI continuation needs actual user/CLI input, not magic wake. Only explicit done/failed owner reports close assignments. Human needs pause automation; tooling failures are not automatically human permission blockers, never bypass protected-path denials. Log milestones and set accurate state before ending. Never automatically open a PR, push, merge or close a source task. Stop checks are structural, not semantic approval or enforcement.`,
      })
    );
    return;
  }

  if (event === "stop") {
    if (input.stop_hook_active) return;
    let error;
    try {
      const session = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      error = structuralError(session);
    } catch {
      error = "missing or invalid session JSON; correct only your own file, do not replace invalid data with a stub";
    }
    if (error) {
      console.log(
        JSON.stringify({
          decision: "block",
          reason: `PARA protocol: data/sessions/${sessionId}.json: ${error}. Follow the skill; this is a structural reminder, not a runtime grant.`,
        })
      );
    }
  }
});
