// Enforces the para-session-protocol: stub the session file at start, refuse to end a turn with a stale one.
const fs = require("fs");
const path = require("path");

const event = process.argv[2];
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {}
  const sessionId = input.sessionId;
  if (!sessionId) return;

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
            state: "working",
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
        )
      );
    }
    console.log(
      JSON.stringify({
        additionalContext: `PARA protocol: your session file is data/sessions/${sessionId}.json (a stub already exists). Fill in agent, title, taskType and task now, append to progress at milestones only (state change, handoff, blocker, result), and set state/result before you end a turn. A hook will block you from finishing while state is still "working".`,
      })
    );
    return;
  }

  if (event === "stop") {
    if (input.stop_hook_active) return;
    let state = null;
    try {
      state = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")).state;
    } catch {}
    if (!state || state === "working") {
      console.log(
        JSON.stringify({
          decision: "block",
          reason: `PARA protocol: data/sessions/${sessionId}.json is ${state ? 'still "working"' : "missing or invalid"}. Update it (progress, state, result/question/needs) before ending the turn.`,
        })
      );
    }
  }
});
