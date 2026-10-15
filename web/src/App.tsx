import { API, agents, agentOf, clock, counts, dark, history, openDelegations, selectedAgent, serviceOnline, sessions, snapshot, toggleTheme, columnOf } from "./store";
import { Activity, Kanban, Logs, Network } from "./Panels";
import { colorOf, initials } from "./util";

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <svg className="spark" />;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

function Kpi({ label, value, hint, k, color }: { label: string; value: number | string; hint: string; k: string; color: string }) {
  return (
    <div className="kpi">
      <div className="kpiLabel">{label}</div>
      <div className="kpiRow"><span className="kpiValue">{value}</span><Spark values={history.value[k] ?? []} color={color} /></div>
      <div className="kpiHint">{hint}</div>
    </div>
  );
}

function AgentCards() {
  return (
    <>
      <div className="sectionHead"><h2>Agents</h2><span>{agents.value.length} agents · {sessions.value.length} sessions</span></div>
      <div className="agentGrid">
        {agents.value.map(([name, items]) => {
          const c = colorOf(name);
          const done = items.filter((s) => s.state === "done").length;
          const running = items.filter((s) => s.state === "working").length;
          const attention = items.filter((s) => columnOf(s) === "attention").length;
          const pct = Math.round((done / items.length) * 100);
          const active = selectedAgent.value === name;
          const latest = items.flatMap((s) => s.progress).sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""))[0]?.note;
          return (
            <div key={name} className={`agent ${active ? "active" : ""}`} style={active ? { borderColor: c } : undefined}
              onClick={() => (selectedAgent.value = active ? null : name)}>
              <div className="agentHead">
                <span className="avatar big" style={{ background: c }}>{initials(name)}</span>
                <div><strong>{name}</strong><small>{items.length} session{items.length > 1 ? "s" : ""}</small></div>
                {running > 0 && <span className="spinner" style={{ borderTopColor: c }} />}
              </div>
              <div className="stats">
                <div><small>Running</small><b>{running}</b></div>
                <div><small>Done</small><b>{done}</b></div>
                <div><small>Needs you</small><b className={attention ? "bad" : ""}>{attention}</b></div>
              </div>
              <div className="term">{latest ?? "Idle"}</div>
              <div className="bar"><i style={{ width: `${pct}%`, background: c }} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Offline() {
  return (
    <div className="offline">
      <h2>Bridge service is not running</h2>
      <p>
        This page only displays data. The Bridge runs on your machine (<code>{API}</code>) and reads
        your <code>data/</code> folder. Install and start it, then this page reconnects automatically:
      </p>
      <pre>{`git clone https://github.com/quocchungthan/PARA-AI-solution
cd PARA-AI-solution/src/Bridge
dotnet run`}</pre>
    </div>
  );
}

export function App() {
  const online = serviceOnline.value;
  const c = counts.value;
  const total = sessions.value.length;
  const isDark = dark.value;
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const time = clock.value.toLocaleTimeString("en-GB");
  const log = snapshot.value?.log ?? [];
  const lastPass = [...log].reverse().find((l) => l.includes("pass #"))?.match(/pass #\d+/)?.[0];
  void agentOf;

  return (
    <>
      <header>
        <div className="brand">
          <span className="logo">⬡</span>
          <div><strong>Bridge</strong><small>Agent Mission Control</small></div>
        </div>
        <span className={`pill ${online ? "up" : "down"}`}>
          <i className="dot" /> {online === null ? "Connecting…" : online ? "Local service online" : "Service offline"}
        </span>
        {online && lastPass && <span className="pill">Scan {lastPass}</span>}
        <div className="spacer" />
        <span className="clock">{time}</span>
        <button className="icon" onClick={toggleTheme} title="Toggle theme">{isDark ? "☾" : "☀"}</button>
      </header>
      <main>
        {online === false && <Offline />}
        {online && snapshot.value && (
          <>
            <div className="kpis">
              <Kpi label="Sessions" value={total} hint={`${c.running} running now`} k="total" color="#3b82f6" />
              <Kpi label="Running" value={c.running} hint="working sessions" k="running" color="#3b82f6" />
              <Kpi label="Needs you" value={c.attention} hint="blocked or human-only" k="attention" color="#ef4444" />
              <Kpi label="Queue" value={c.queue} hint="pending / waiting for input" k="queue" color="#eab308" />
              <Kpi label="Completed" value={c.done} hint={`${total ? Math.round((c.done / total) * 100) : 0}% of all sessions`} k="done" color="#10b981" />
              <Kpi label="Open delegations" value={openDelegations.value} hint="handoffs awaiting result" k="delegations" color="#8b5cf6" />
            </div>
            <AgentCards />
            <div className="split">
              <Network />
              <Kanban />
            </div>
            <div className="split3">
              <Activity />
              <Logs />
            </div>
          </>
        )}
      </main>
    </>
  );
}
