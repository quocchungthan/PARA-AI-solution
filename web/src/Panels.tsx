import { agentOf, clock, columnOf, selectedAgent, snapshot, visibleSessions, agents, type Column, type Session } from "./store";
import { STATE_COLOR, ago, colorOf, initials, stateLabel } from "./util";

export function Network() {
  const W = 760, H = 420, cx = W / 2, cy = H / 2;
  const list = agents.value;
  const nodes = list.map(([name, items], i) => {
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
    return { name, items, x: cx + Math.cos(a) * 150, y: cy + Math.sin(a) * 150 * 0.85, a };
  });
  return (
    <section className="panel">
      <h3>Orchestration network <span className="chip">{snapshot.value?.sessions.length ?? 0} sessions</span></h3>
      <p className="sub">BRIDGE → agents → sessions</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="net">
        {nodes.map((n) => (
          <line key={n.name} x1={cx} y1={cy} x2={n.x} y2={n.y} className="link" />
        ))}
        {nodes.map((n) => {
          const c = colorOf(n.name);
          const active = selectedAgent.value === n.name;
          return (
            <g key={n.name} className="node" onClick={() => (selectedAgent.value = active ? null : n.name)}>
              {n.items.slice(0, 14).map((s, i) => {
                const ang = n.a + ((i - n.items.length / 2) / 6) * 1.2;
                const r = 46 + (i % 3) * 8;
                return (
                  <circle key={s.sessionId} cx={n.x + Math.cos(ang) * r} cy={n.y + Math.sin(ang) * r} r={4}
                    fill={STATE_COLOR[s.state] ?? "var(--muted)"} className={s.state === "working" ? "pulse" : ""} />
                );
              })}
              <circle cx={n.x} cy={n.y} r={active ? 24 : 20} fill="none" stroke={c} strokeWidth="2" />
              <circle cx={n.x} cy={n.y} r={16} fill={c} opacity=".18" />
              <text x={n.x} y={n.y + 4} textAnchor="middle" className="nodeLetter" fill={c}>{initials(n.name)}</text>
              <text x={n.x} y={n.y + 38} textAnchor="middle" className="nodeLabel">{n.name}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={42} className="hub" />
        <circle cx={cx} cy={cy} r={34} className="hubIn" />
        <text x={cx} y={cy + 4} textAnchor="middle" className="hubText">BRIDGE</text>
        <text x={cx} y={cy + 17} textAnchor="middle" className="hubSub">orchestrator</text>
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

function Card({ s }: { s: Session }) {
  const name = agentOf(s);
  const c = colorOf(name);
  const note = s.question ?? s.progress.at(-1)?.note;
  return (
    <div className="task">
      <div className="taskTop">
        <span className="id">{s.sessionId.slice(0, 8)}</span>
        <span className="state" style={{ color: STATE_COLOR[s.state] }}>{stateLabel(s)}</span>
      </div>
      <div className="taskTitle">{s.title && !s.title.startsWith("(") ? s.title : s.task?.slice(0, 70) ?? "(untitled)"}</div>
      {note && <div className="taskNote">{note}</div>}
      <div className="taskFoot">
        <span className="avatar" style={{ background: c }}>{initials(name)}</span>
        <span>{name}</span>
        <span className="when">{ago(s.updatedAt, clock.value.getTime())}</span>
      </div>
    </div>
  );
}

export function Kanban() {
  const list = visibleSessions.value;
  return (
    <section className="panel">
      <h3>Work queue {selectedAgent.value && <span className="chip filter" onClick={() => (selectedAgent.value = null)}>{selectedAgent.value} ✕</span>}</h3>
      <p className="sub">sessions by state, newest first</p>
      <div className="kanban">
        {COLS.map((col) => {
          const items = list.filter((s) => columnOf(s) === col.key);
          return (
            <div key={col.key} className="col">
              <div className="colHead"><span>{col.icon} {col.label}</span><span className="count">{items.length}</span></div>
              <div className="colBody">{items.slice(0, 8).map((s) => <Card key={s.sessionId} s={s} />)}</div>
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
      <h3>Live activity <span className="live">● Live</span></h3>
      <p className="sub">progress notes from all sessions</p>
      <ul className="feed">
        {events.map((e, i) => (
          <li key={i}>
            <span className="tag" style={{ color: colorOf(agentOf(e.s)) }}>● {agentOf(e.s)}</span>
            <span className="note">{e.note}</span>
            <span className="when">{ago(e.ts, now)}</span>
          </li>
        ))}
        {events.length === 0 && <li className="empty">No activity yet.</li>}
      </ul>
    </section>
  );
}

export function Logs() {
  const lines = snapshot.value?.log ?? [];
  return (
    <section className="panel">
      <h3>Runtime logs <span className="chip">{lines.length} lines</span></h3>
      <p className="sub">bridge · bridge.log</p>
      <pre className="logs">
        {lines.slice(-60).map((l, i) => {
          const m = l.match(/^(\S+)T(\S+?)(?:\.\d+)?\s+(\w+)\s+(.*)$/);
          if (!m) return <div key={i}>{l}</div>;
          return (
            <div key={i}><span className="t">{m[2]}</span> <span className={`lv ${m[3]}`}>{m[3].padEnd(5)}</span> {m[4]}</div>
          );
        })}
      </pre>
    </section>
  );
}
