import { useEffect, useRef } from "react";
import { signal } from "@preact/signals-react";
import { agentOf, clock, columnOf, openSession, selectedAgent, snapshot, visibleSessions, agents, type Column, type Session } from "./store";
import { STATE_COLOR, ago, colorOf, initials, stateLabel } from "./util";
import { isFresh } from "./Fx";

const hovered = signal<string | null>(null);

export function Network() {
  const W = 560, H = 560, cx = W / 2, cy = H / 2, R = 190;
  const list = agents.value;
  const nodes = list.map(([name, items], i) => {
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
    return { name, items, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
  });
  const running = (snapshot.value?.sessions ?? []).filter((s) => s.state === "working").length;
  return (
    <section className="panel netPanel">
      <h3>Orchestration network <span className="chip">{snapshot.value?.sessions.length ?? 0} sessions</span></h3>
      <p className="sub">BRIDGE → agents → sessions · click a node to filter, a dot to open</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="net">
        <defs>
          <radialGradient id="hubGlow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={110} fill="url(#hubGlow)" className={running ? "breathe" : ""} />
        {nodes.map((n) => {
          const busy = n.items.filter((s) => s.state === "working").length;
          const attention = n.items.filter((s) => columnOf(s) === "attention").length;
          const c = colorOf(n.name);
          const path = `M${cx},${cy} L${n.x},${n.y}`;
          const back = `M${n.x},${n.y} L${cx},${cy}`;
          const dim = selectedAgent.value && selectedAgent.value !== n.name;
          return (
            <g key={n.name} className={dim ? "dim" : ""}>
              <line x1={cx} y1={cy} x2={n.x} y2={n.y} className={`link ${busy ? "hot" : ""}`} style={busy ? { stroke: c } : undefined} />
              {Array.from({ length: Math.min(busy, 3) }, (_, i) => (
                <circle key={`p${i}`} r="3" fill={c} className="particle">
                  <animateMotion dur="1.8s" begin={`${i * 0.6}s`} repeatCount="indefinite" path={path} />
                </circle>
              ))}
              {attention > 0 && (
                <circle r="3" fill="var(--bad)" className="particle">
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={back} />
                </circle>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const c = colorOf(n.name);
          const active = selectedAgent.value === n.name;
          const dim = selectedAgent.value && !active;
          const busy = n.items.some((s) => s.state === "working");
          return (
            <g key={n.name} className={`node ${dim ? "dim" : ""} ${active ? "on" : ""}`}
              onMouseEnter={() => (hovered.value = n.name)} onMouseLeave={() => (hovered.value = null)}>
              {n.items.slice(0, 14).map((s, i) => {
                const ang = n.a + ((i - n.items.length / 2) / 6) * 1.2;
                const r = 46 + (i % 3) * 8;
                return (
                  <circle key={s.sessionId} cx={n.x + Math.cos(ang) * r} cy={n.y + Math.sin(ang) * r} r={hovered.value === n.name ? 5 : 4}
                    fill={STATE_COLOR[s.state] ?? "var(--muted)"} className={`sdot ${s.state === "working" ? "pulse" : ""}`}
                    onClick={() => (openSession.value = s.sessionId)}>
                    <title>{`${s.title ?? s.sessionId} · ${stateLabel(s)}`}</title>
                  </circle>
                );
              })}
              <g className="nodeCore" onClick={() => (selectedAgent.value = active ? null : n.name)}>
                {busy && <circle cx={n.x} cy={n.y} r={22} fill="none" stroke={c} className="ripple" />}
                <circle cx={n.x} cy={n.y} r={active ? 24 : 20} fill="var(--panel)" stroke={c} strokeWidth="2" />
                <circle cx={n.x} cy={n.y} r={16} fill={c} opacity=".18" />
                <text x={n.x} y={n.y + 4} textAnchor="middle" className="nodeLetter" fill={c}>{initials(n.name)}</text>
                <text x={n.x} y={n.y + 38} textAnchor="middle" className="nodeLabel">{n.name}</text>
              </g>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={48} className="hubRing" />
        <circle cx={cx} cy={cy} r={42} className="hub" />
        <circle cx={cx} cy={cy} r={34} className="hubIn" />
        <text x={cx} y={cy + 4} textAnchor="middle" className="hubText">BRIDGE</text>
        <text x={cx} y={cy + 17} textAnchor="middle" className="hubSub">{running ? `${running} running` : "orchestrator"}</text>
      </svg>
    </section>
  );
}

const COLS: { key: Column; label: string; icon: string }[] = [
  { key: "queue", label: "Queue", icon: "▤" },
  { key: "running", label: "Running", icon: "◔" },
  { key: "attention", label: "Needs you", icon: "◉" },
  { key: "done", label: "Done", icon: "✓" },
];

function Card({ s, i }: { s: Session; i: number }) {
  const name = agentOf(s);
  const c = colorOf(name);
  const note = s.question ?? s.progress.at(-1)?.note;
  return (
    <div className={`task ${s.state} ${isFresh(s.sessionId) ? "flash" : ""}`} style={{ animationDelay: `${i * 35}ms`, ["--c" as string]: c }}
      onClick={() => (openSession.value = s.sessionId)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && (openSession.value = s.sessionId)}>
      <div className="taskTop">
        <span className="id">{s.sessionId.slice(0, 8)}</span>
        <span className="state" style={{ color: STATE_COLOR[s.state] }}>
          {s.state === "working" && <i className="dot" />} {stateLabel(s)}
        </span>
      </div>
      <div className="taskTitle">{s.title && !s.title.startsWith("(") ? s.title : s.task?.slice(0, 70) ?? "(untitled)"}</div>
      {note && <div className="taskNote">{note}</div>}
      <div className="taskFoot">
        <span className="avatar" style={{ background: c }}>{initials(name)}</span>
        <span>{name}</span>
        <span className="when">{ago(s.updatedAt, clock.value.getTime())}</span>
      </div>
      {s.state === "working" && <div className="scan" />}
    </div>
  );
}

const PAGE = 5;
const shown = signal<Partial<Record<Column, number>>>({});

export function Kanban() {
  const list = visibleSessions.value;
  return (
    <section className="panel">
      <h3>Work queue {selectedAgent.value && <span className="chip filter" onClick={() => (selectedAgent.value = null)}>{selectedAgent.value} ✕</span>}</h3>
      <p className="sub">sessions by state, newest first · click a card for details</p>
      <div className="kanban">
        {COLS.map((col) => {
          const items = list.filter((s) => columnOf(s) === col.key);
          const limit = shown.value[col.key] ?? PAGE;
          const rest = items.length - limit;
          return (
            <div key={col.key} className={`col ${col.key}`}>
              <div className="colHead"><span>{col.icon} {col.label}</span><span className="count">{items.length}</span></div>
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

export function Activity() {
  const now = clock.value.getTime();
  const events = visibleSessions.value
    .flatMap((s) => s.progress.map((p) => ({ s, ...p })))
    .sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""))
    .slice(0, 12);
  return (
    <section className="panel">
      <h3>Live activity <span className="live"><i className="dot" /> Live</span></h3>
      <p className="sub">progress notes from all sessions</p>
      <ul className="feed">
        {events.map((e) => {
          const recent = e.ts && now - new Date(e.ts).getTime() < 60000;
          return (
            <li key={`${e.s.sessionId}-${e.ts}`} className={recent ? "recent" : ""} onClick={() => (openSession.value = e.s.sessionId)}>
              <span className="tag" style={{ color: colorOf(agentOf(e.s)) }}>● {agentOf(e.s)}</span>
              <span className="note">{e.note}</span>
              <span className="when">{ago(e.ts, now)}</span>
            </li>
          );
        })}
        {events.length === 0 && <li className="empty">No activity yet.</li>}
      </ul>
    </section>
  );
}

const LEVELS = ["ALL", "INFO", "WARN", "ERROR"] as const;
const level = signal<(typeof LEVELS)[number]>("ALL");
const follow = signal(true);

export function Logs() {
  const lines = snapshot.value?.log ?? [];
  const ref = useRef<HTMLPreElement>(null);
  const seen = new Map<string, number>();
  const parsed = lines.slice(-200).map((l) => {
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    const key = `${l}#${n}`;
    const m = l.match(/^(\S+)T(\S+?)(?:\.\d+)?\s+(\w+)\s+(.*)$/);
    return m ? { t: m[2], lv: m[3], msg: m[4], key } : { t: "", lv: "", msg: l, key };
  });
  const shownLines = parsed.filter((p) => level.value === "ALL" || p.lv === level.value).slice(-80);
  useEffect(() => {
    if (follow.value && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  return (
    <section className="panel">
      <h3>
        Runtime logs
        <span className="seg">
          {LEVELS.map((l) => (
            <button key={l} className={level.value === l ? "on" : ""} onClick={() => (level.value = l)}>{l}</button>
          ))}
        </span>
        <button className={`chip toggle ${follow.value ? "on" : ""}`} onClick={() => (follow.value = !follow.value)}
          title="Auto-scroll to newest">{follow.value ? "⏵ following" : "⏸ paused"}</button>
      </h3>
      <p className="sub">bridge · bridge.log · {lines.length} lines</p>
      <pre className="logs" ref={ref} onWheel={(e) => e.deltaY < 0 && (follow.value = false)}>
        {shownLines.map((p) => (
          <div key={p.key} className="logLine">
            {p.t ? <><span className="t">{p.t}</span> <span className={`lv ${p.lv}`}>{p.lv.padEnd(5)}</span> {p.msg}</> : p.msg}
          </div>
        ))}
        {follow.value && <span className="caret">▌</span>}
      </pre>
    </section>
  );
}
