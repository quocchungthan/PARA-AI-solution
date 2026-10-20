import { useEffect, useRef } from "react";
import { signal } from "@preact/signals-react";
import { ArrowsClockwise, ChartLineUp, CheckCircle, Gauge, Kanban as KanbanIcon, ListDashes, Pulse, UsersThree, Warning, X, type Icon } from "@phosphor-icons/react";
import {
  agentOf, agents, clock, columnOf, highlighted, openSession, page, selectedAgent, sessions, snapshot, visibleSessions,
  type Column, type Session,
} from "./store";
import { STATE_COLOR, actionOf, ago, plural, roleOf, stateLabel, titleOf } from "./util";
import { AnimatedNumber, isFresh } from "./Fx";
import { AgentGlyph } from "./Glyph";
import { GlowCard } from "./Effects";
import { assignmentColumn, assignmentScope, linkedSessionTitle, sessionExecution, TASK_PHASES, tasksInPhase } from "./workflow";

export function TeamWorkflow() {
  const all = visibleSessions.value;
  return (
    <section className="panel teamWorkflow" aria-labelledby="team-workflow-title">
      <div className="workflowHeader">
        <div><h2 id="team-workflow-title">Session phases</h2>
          <p className="sub">Recorded phases are not execution status. Delivery stays local; no automatic PR.</p></div>
        <button type="button" className="workflowButton" onClick={() => (page.value = "tasks")}><KanbanIcon aria-hidden="true" size={16} /> View assignments</button>
      </div>
      <div className="teamStages">
        {TASK_PHASES.map((phase) => {
          const tasks = tasksInPhase(all, phase.key);
          return (
            <section key={phase.key} aria-label={phase.label}>
              <h3>{phase.label} <span className="chip">{tasks.length}</span></h3>
              {tasks.map((s) => (
                <button key={s.sessionId} className="teamTask" onClick={() => (openSession.value = s.sessionId)}>
                  <strong>{linkedSessionTitle(s, snapshot.value?.assignments)}</strong>
                  <small className="workflowStatus" data-state={s.state}>{sessionExecution(s)}</small>
                  {s.question && <small>{s.question}</small>}
                </button>
              ))}
              {!tasks.length && <p className="emptyCol">No sessions</p>}
            </section>
          );
        })}
      </div>
      <p className="sub">Start a coordinator CLI session with your GitHub issues or Azure Boards query. Existing sessions without a recorded task phase remain in the session queue below.</p>
    </section>
  );
}

export function AssignmentQueue() {
  const all = snapshot.value?.assignments;
  const tasks = (all ?? []).filter((a) => a.protocol === 2);
  const legacy = (all ?? []).filter((a) => a.protocol !== 2);
  const ledgerError = snapshot.value?.assignmentError;
  const receipts = (snapshot.value?.outboxReceipts ?? []).filter((r) => r.status === "rejected");
  const known = new Set(sessions.value.map((s) => s.sessionId));
  const columns = [
    { key: "queued", label: "Queued" },
    { key: "running", label: "Running / granted" },
    { key: "waiting", label: "Waiting / attention" },
    { key: "finished", label: "Finished" },
  ];
  const sessionTasks = tasks.filter((a) => a.originId === openSession.value || a.targetId === openSession.value);
  return (
    <section className="panel assignmentQueue" aria-labelledby="assignment-queue-title">
      <div className="workflowHeader">
        <div><h2><span id="assignment-queue-title">Team assignments</span> <span className="chip">{tasks.length} tasks</span></h2>
          <p className="sub">Managed work, scheduling blockers and explicit worker reports.</p></div>
        <button type="button" className="workflowButton" onClick={() => (page.value = "sessions")}><UsersThree aria-hidden="true" size={16} /> View sessions</button>
      </div>
      <p className="workflowHint">A grant reserves ownership; it does not prove activity. Independent approved CLI work needs no Bridge grant.</p>
      {!all && !ledgerError && <p className="callout warn" role="status">This Bridge does not expose the assignment list. Restart into the updated Bridge; session Queue cards are not a task queue.</p>}
      {ledgerError && <p className="callout bad" role="alert">{ledgerError}</p>}
      {!ledgerError && all && !tasks.length && <p className="emptyCol">No assignments yet. Sessions publish requests through their outbox.</p>}
      {sessionTasks.length > 0 && <p className="sub">Selected session is linked to {sessionTasks.length} task(s).</p>}
      <div className="assignmentBoard">
        {columns.map((column) => {
          const items = tasks.filter((a) => assignmentColumn(a) === column.key);
          return <section key={column.key} className="assignmentColumn" aria-label={`${column.label} tasks`}>
            <h3>{column.label} <span className="chip">{items.length}</span></h3>
            {!items.length && <p className="emptyCol">No tasks</p>}
        {items.map((a) => (
          <article className="assignmentItem" data-state={a.workState || "unknown"} key={a.key} aria-label={a.title || a.key}>
            <div className="assignmentHeading">
              <h3>{a.title || a.key}</h3>
              <span className="chip workflowStatus" data-state={a.workState || "unknown"}>{(a.workState || a.status || "unknown").replaceAll("_", " ")}</span>
              {a.protocol === 2 && <span className="chip">{a.points} point{a.points === 1 ? "" : "s"} · {a.mode === "self" ? "same session" : "delegated"}</span>}
              {a.protocol !== 2 && <span className="chip">legacy handoff</span>}
            </div>
            <dl className="assignmentPeople">
              <div><dt>Supervisor</dt><dd>{sessions.value.find((s) => s.sessionId === a.originId)?.title || a.originId}</dd></div>
              <div><dt>Worker</dt><dd>{a.targetId ? (() => {
                const worker = sessions.value.find((s) => s.sessionId === a.targetId);
                return worker ? linkedSessionTitle(worker, tasks) : a.targetId;
              })() : "Not created yet"}</dd></div>
            </dl>
            <div className="assignmentReason">
              <b>{a.workState === "queued" ? "Why queued" : assignmentColumn(a) === "finished" ? "Outcome" : "Next action"}</b>
              <p>{a.scheduling?.summary || (a.workState === "queued"
                ? "The running Bridge has not exposed its scheduling reason. Queued is not proof that a worker is running."
                : a.mode === "self" && a.workState === "running"
                  ? "Reserved by the owning CLI, not automatically executing. Continue that existing CLI to report or safely close this assignment; do not open a duplicate worker."
                  : a.reports.at(-1)?.summary || "Waiting for an explicit worker report.")}</p>
              {a.scheduling?.blockingAssignmentIds.map((id) => (
                <p key={id}>Blocking task: {tasks.find((task) => task.key === id)?.title || id}</p>
              ))}
            </div>
            {a.mode === "self" && a.workState === "queued" && <p className="callout warn">
              Legacy attended request. In its owning CLI, cancel this ungranted request and confirm cancellation before continuing directly or submitting a new managed-worker request. Do not create another self request.
            </p>}
            {!["queued", "running", "waiting", "blocked", "needs_human", "recovery_required", "done", "failed", "cancelled"].includes(a.workState ?? "") &&
              <p className="callout warn">Execution state is unknown; this assignment has not been counted as running or complete.</p>}
            <div className="assignmentLinks">
              <button type="button" disabled={!known.has(a.originId)} onClick={() => (openSession.value = a.originId)}>Open supervisor</button>
              <button type="button" disabled={!known.has(a.targetId)} onClick={() => (openSession.value = a.targetId)}>Open worker</button>
            </div>
            {!!a.dependsOn.length && <p className="sub">Depends on: {a.dependsOn.join(", ")}</p>}
            {a.lastError && <p className="callout bad">{a.lastError}</p>}
            <details>
              <summary>Scope and reports ({a.reports.length})</summary>
              <p className="assignmentId">Assignment ID: {a.key}</p>
              {!!a.acceptance.length && <><h4>Acceptance criteria</h4><ul>{a.acceptance.map((text, i) => <li key={i}>{text}</li>)}</ul></>}
              <p className="sub">{assignmentScope(a)}</p>
              {!a.reports.length && <p className="sub">No explicit worker report yet.</p>}
              <ol className="assignmentReports">{[...a.reports].reverse().map((r) => (
                <li key={r.id}>
                  <b>{r.kind.replaceAll("_", " ")}</b><p>{r.summary}</p>
                  {r.verification && <p>Verification: {r.verification}</p>}
                  {!!r.evidence.length && <p>Evidence: {r.evidence.join(", ")}</p>}
                  {r.question && <p>Question: {r.question}</p>}
                </li>
              ))}</ol>
            </details>
          </article>
        ))}
          </section>;
        })}
      </div>
      {!!legacy.length && <details><summary>Historical handoffs ({legacy.length})</summary>
        <ul>{legacy.map((a) => <li key={a.key}>{a.key}: {a.status.replaceAll("_", " ")}</li>)}</ul>
      </details>}
      {!!receipts.length && (
        <details className="callout bad">
          <summary>Rejected outbox commands ({receipts.length})</summary>
          <ul>{receipts.map((r) => <li key={`${r.sessionId}:${r.commandId}`}>{r.commandId}: {r.error || "Rejected by the Bridge"}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

const COLS: { key: Column; label: string; icon: Icon }[] = [
  { key: "queue", label: "Queue", icon: ListDashes },
  { key: "running", label: "Running", icon: Pulse },
  { key: "attention", label: "Needs you", icon: Warning },
  { key: "done", label: "Done", icon: CheckCircle },
];

const byNewest = (a: Session, b: Session) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");

function Card({ s, i }: { s: Session; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const name = agentOf(s);
  const note = s.question ?? s.progress.at(-1)?.note;
  const details = [note, ...(s.issues ?? [])].filter(Boolean).join(" · ");
  const action = actionOf(s);
  const lit = highlighted.value === s.sessionId;
  const hasIssues = (s.issues?.length ?? 0) > 0;
  const flagged = s.stale || hasIssues;
  useEffect(() => {
    if (lit) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [lit]);
  const open = () => {
    if (lit) highlighted.value = null;
    openSession.value = s.sessionId;
  };
  return (
    <GlowCard radius={14} className="taskGlow" style={{ animationDelay: `${i * 35}ms` }} active={s.state === "working" && !s.stale}>
      <div ref={ref} className={`task ${s.state} ${flagged ? "stale" : ""} ${isFresh(s.sessionId) ? "flash" : ""} ${lit ? "highlight" : ""}`}
        onClick={open} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && open()}>
        <div className="taskTop">
          <span className="id">{s.sessionId.slice(0, 8)}</span>
          {lit && <span className="newTag">new</span>}
          <span className="state" style={{ color: flagged ? "var(--warn)" : STATE_COLOR[s.state] }}>
            {flagged
              ? <Warning weight="fill" />
              : s.state === "working" && <i className="dot" />} {s.stale ? "Stale" : hasIssues ? "Protocol issue" : stateLabel(s)}
          </span>
        </div>
        <div className="taskTitle">{linkedSessionTitle(s, snapshot.value?.assignments)}</div>
        {details && <div className="taskNote">{details}</div>}
        <div className="taskFoot">
          <AgentGlyph name={name} size="sm" />
          <span>{name}</span>
          <span className="when">{ago(s.updatedAt, clock.value.getTime())}</span>
        </div>
        {action && (
          <button className="actionBtn" onClick={(e) => { e.stopPropagation(); open(); }}
            title="Open the session to see what it needs">{action}</button>
        )}
      </div>
    </GlowCard>
  );
}

const PAGE = 5;
const shown = signal<Partial<Record<Column, number>>>({});

export function Kanban() {
  const list = [...visibleSessions.value].sort(byNewest);
  const lit = highlighted.value;
  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <h2><KanbanIcon weight="duotone" /> Work queue <span className="chip">{plural(list.length, "session")}</span></h2>
          <p className="sub">Grouped by state · newest first · click a card for details</p>
        </div>
        {selectedAgent.value && (
          <button className="chip filter" onClick={() => (selectedAgent.value = null)}>{selectedAgent.value} <X /></button>
        )}
      </div>
      <div className="kanban">
        {COLS.map((col) => {
          const items = list.filter((s) => columnOf(s) === col.key);
          const litAt = lit ? items.findIndex((s) => s.sessionId === lit) : -1;
          const limit = Math.max(shown.value[col.key] ?? PAGE, litAt + 1);
          const rest = items.length - limit;
          const ColIcon = col.icon;
          return (
            <div key={col.key} className={`col ${col.key}`}>
              <div className="colHead"><span><ColIcon weight="duotone" /> {col.label}</span><span className="count">{items.length}</span></div>
              <div className="colBody">
                {items.slice(0, limit).map((s, i) => <Card key={s.sessionId} s={s} i={i} />)}
                {items.length === 0 && <div className="emptyCol">Nothing here</div>}
                {rest > 0 && (
                  <button className="more" onClick={() => (shown.value = { ...shown.value, [col.key]: limit + PAGE })}>
                    Show {Math.min(PAGE, rest)} more ({rest} hidden)
                  </button>
                )}
                {limit > PAGE && rest <= 0 && (
                  <button className="more" onClick={() => (shown.value = { ...shown.value, [col.key]: PAGE })}>Show less</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const HOURS = 12;
export function Throughput() {
  const now = clock.value.getTime();
  const hour = 3600_000;
  const start = Math.floor(now / hour) * hour - (HOURS - 1) * hour;
  const started = Array<number>(HOURS).fill(0), done = Array<number>(HOURS).fill(0);
  const bucket = (iso?: string) => (iso ? Math.floor((new Date(iso).getTime() - start) / hour) : -1);
  for (const s of sessions.value) {
    const first = s.progress.map((p) => p.ts).filter(Boolean).sort()[0] ?? s.updatedAt;
    const b = bucket(first);
    if (b >= 0 && b < HOURS) started[b]++;
    const d = s.state === "done" ? bucket(s.updatedAt) : -1;
    if (d >= 0 && d < HOURS) done[d]++;
  }
  const w = 460, h = 150, pad = 6, max = Math.max(2, ...started, ...done);
  const X = (i: number) => pad + (i / (HOURS - 1)) * (w - 2 * pad);
  const Y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const line = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join(" ");
  const area = (d: number[]) => `${line(d)} L${X(HOURS - 1)},${h - pad} L${X(0)},${h - pad} Z`;
  return (
    <section className="panel">
      <h2><ChartLineUp weight="duotone" /> Throughput</h2>
      <p className="sub">Sessions started vs. completed per hour · last {HOURS}h</p>
      <svg className="area" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
        aria-label={`Started ${started.reduce((a, b) => a + b, 0)}, completed ${done.reduce((a, b) => a + b, 0)} in the last ${HOURS} hours`}>
        <defs>
          <linearGradient id="thrStarted" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--tone-2)" stopOpacity=".25" /><stop offset="1" stopColor="var(--tone-2)" stopOpacity="0" /></linearGradient>
          <linearGradient id="thrDone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--ok)" stopOpacity=".35" /><stop offset="1" stopColor="var(--ok)" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={pad} x2={w - pad} y1={pad + t * (h - 2 * pad)} y2={pad + t * (h - 2 * pad)} className="gridLine" />)}
        <path d={area(started)} fill="url(#thrStarted)" />
        <path d={line(started)} fill="none" stroke="var(--tone-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={area(done)} fill="url(#thrDone)" />
        <path d={line(done)} fill="none" stroke="var(--ok)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="legend"><span><i style={{ background: "var(--tone-2)" }} />Started</span><span><i style={{ background: "var(--ok)" }} />Completed</span></div>
    </section>
  );
}

export function Health() {
  const all = sessions.value;
  const list = agents.value;
  const dels = snapshot.value?.delegations ?? [];
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const bars = [
    { label: "Completion rate", value: pct(all.filter((s) => s.state === "done").length, all.length), color: "var(--ok)" },
    { label: "Agent utilization", value: pct(list.filter(([, items]) => items.some((s) => s.state === "working")).length, list.length), color: "var(--tone-0)" },
    { label: "Delegations resolved", value: pct(dels.filter((d) => d.status === "result_fed").length, dels.length), color: "var(--info)" },
  ];
  return (
    <section className="panel">
      <h2><Gauge weight="duotone" /> Health</h2>
      <p className="sub">Live ratios across all sessions</p>
      {bars.map((b) => (
        <div key={b.label} className="bullet">
          <span>{b.label}</span>
          <div className="track"><i style={{ width: `${b.value}%`, background: b.color }} /></div>
          <b><AnimatedNumber value={b.value} />%</b>
        </div>
      ))}
    </section>
  );
}

export function AgentCards() {
  const list = agents.value;
  return (
    <>
      <div className="pageHead">
        <h2><UsersThree weight="duotone" /> Agents <span className="chip">{plural(list.length, "agent")}</span></h2>
        <p className="sub">Role, workload and latest signal · click an agent to see its sessions</p>
      </div>
      <div className="agentGrid">
        {list.map(([name, items], idx) => {
          const done = items.filter((s) => s.state === "done").length;
          const running = items.filter((s) => s.state === "working").length;
          const attention = items.filter((s) => columnOf(s) === "attention").length;
          const pct = items.length ? Math.round((done / items.length) * 100) : 0;
          const latest = items.flatMap((s) => s.progress).sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""))[0]?.note;
          return (
            <GlowCard key={name} radius={22} className="agentGlow" style={{ animationDelay: `${idx * 45}ms` }} active={running > 0}>
              <button className={`agent ${running ? "busy" : ""}`}
                onClick={() => { selectedAgent.value = name; page.value = "sessions"; }}>
                <div className="agentHead">
                  <AgentGlyph name={name} size="lg" />
                  <div><strong>{name}</strong><small>{roleOf(name)} · {plural(items.length, "session")}</small></div>
                  {running > 0
                    ? <span className="statusTag run"><i className="dot" />{running} running</span>
                    : <span className="statusTag">idle</span>}
                </div>
                <div className="stats">
                  <div><small>Done</small><b><AnimatedNumber value={done} /></b></div>
                  <div><small>Running</small><b><AnimatedNumber value={running} /></b></div>
                  <div><small>Needs you</small><b className={attention ? "warn" : ""}><AnimatedNumber value={attention} /></b></div>
                </div>
                <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="term"><span className="prompt">›</span> {latest ?? "Idle"}{running > 0 && <span className="caret">▌</span>}</div>
              </button>
            </GlowCard>
          );
        })}
      </div>
    </>
  );
}

// Bridge only writes DEBUG/INFO/WARN/ERROR; INFO lines that report success are shown as OK.
const OK_RE = /\b(done|delivered|result_fed|started)\b|assigned ->/;
const LEVELS = ["ALL", "INFO", "OK", "WARN", "ERROR", "DEBUG"] as const;
type Level = (typeof LEVELS)[number];
const level = signal<Level>("ALL");
const follow = signal(true);
// "ALL" hides DEBUG chatter; the DEBUG filter shows it on demand.
const matches = (lv: string, want: Level) => (want === "ALL" ? lv !== "DEBUG" : lv === want);

export function Logs() {
  const lines = snapshot.value?.log ?? [];
  const lastPass = [...lines].reverse().find((l) => l.includes("pass #"))?.match(/pass #\d+/)?.[0];
  const ref = useRef<HTMLDivElement>(null);
  const seen = new Map<string, number>();
  let prev = "";
  const parsed = lines.slice(-200).map((l) => {
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    const key = `${l}#${n}`;
    const m = l.match(/^\S+T(\d\d:\d\d:\d\d)\S*\s+(\w+)\s+(?:\[([^\]]+)\]\s+)?(.*)$/);
    if (!m) return { t: "", lv: prev, c: "", msg: l, key, cont: true };
    const lv = m[2] === "INFO" && OK_RE.test(m[4]) ? "OK" : m[2];
    prev = lv;
    return { t: m[1], lv, c: m[3] ?? "", msg: m[4], key, cont: false };
  });
  const rows = parsed.filter((p) => matches(p.lv, level.value)).slice(-120);
  useEffect(() => {
    if (follow.value && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  return (
    <section className="console" aria-labelledby="logs-title">
      <div className="consoleBar">
        <span className="tl" aria-hidden><i /><i /><i /></span>
        <h2 id="logs-title">Logs</h2>
        <span className="path">{lastPass ? `Scan ${lastPass}` : `${lines.length} lines`}</span>
        <button className={`chip toggle ${follow.value ? "on" : ""}`} onClick={() => (follow.value = !follow.value)}
          title="Auto-scroll to newest" aria-pressed={follow.value}>
          <ArrowsClockwise /> {follow.value ? "following" : "paused"}
        </button>
      </div>
      <div className="seg" role="group" aria-label="Filter logs by level">
        {LEVELS.map((l) => (
          <button key={l} className={`${l} ${level.value === l ? "on" : ""}`} aria-pressed={level.value === l}
            title={l === "ALL" ? "All levels except DEBUG" : undefined} onClick={() => (level.value = l)}>{l}</button>
        ))}
      </div>
      <div className="stream" ref={ref} tabIndex={0} role="log" aria-label="Runtime logs"
        onWheel={(e) => e.deltaY < 0 && (follow.value = false)}>
        {rows.map((p) => (
          <div key={p.key} className={`logLine ${p.lv} ${p.cont ? "cont" : ""}`}>
            <span className="t">{p.t}</span>
            <span className={`lv ${p.lv}`}>{p.cont ? "" : p.lv}</span>
            <span className="msg">{p.c && <span className="comp">[{p.c}]</span>} {p.msg}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="emptyCol">No {level.value === "ALL" ? "" : level.value + " "}lines yet.</div>}
      </div>
    </section>
  );
}
