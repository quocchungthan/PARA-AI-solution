import { useEffect, useRef } from "react";
import { API, agents, clock, columnOf, counts, dark, history, openDelegations, pollCount, query, selectedAgent, serviceOnline, sessions, snapshot, toggleTheme } from "./store";
import { Activity, Kanban, Logs, Network } from "./Panels";
import { AnimatedNumber, Drawer, Spark } from "./Fx";
import { colorOf, initials } from "./util";

function Kpi({ label, value, hint, k, color, icon, i }: { label: string; value: number; hint: string; k: string; color: string; icon: string; i: number }) {
  return (
    <div className="kpi" style={{ ["--c" as string]: color, animationDelay: `${i * 50}ms` }}>
      <div className="kpiLabel"><span className="kpiIcon">{icon}</span>{label}</div>
      <div className="kpiRow"><span className="kpiValue"><AnimatedNumber value={value} /></span><Spark values={history.value[k] ?? []} color={color} /></div>
      <div className="kpiHint">{hint}</div>
    </div>
  );
}

function AgentCards() {
  return (
    <>
      <div className="sectionHead"><h2>Agents</h2><span>{agents.value.length} agents · {sessions.value.length} sessions · click to filter</span></div>
      <div className="agentGrid">
        {agents.value.map(([name, items], idx) => {
          const c = colorOf(name);
          const done = items.filter((s) => s.state === "done").length;
          const running = items.filter((s) => s.state === "working").length;
          const attention = items.filter((s) => columnOf(s) === "attention").length;
          const pct = Math.round((done / items.length) * 100);
          const active = selectedAgent.value === name;
          const latest = items.flatMap((s) => s.progress).sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""))[0]?.note;
          return (
            <div key={name} className={`agent ${active ? "active" : ""} ${running ? "busy" : ""}`}
              style={{ ["--c" as string]: c, animationDelay: `${idx * 45}ms` }}
              onClick={() => (selectedAgent.value = active ? null : name)}>
              <div className="agentHead">
                <span className="avatar big" style={{ background: c }}>{initials(name)}</span>
                <div><strong>{name}</strong><small>{items.length} session{items.length > 1 ? "s" : ""}</small></div>
                {running > 0 ? <span className="spinner" /> : <span className="idle">idle</span>}
              </div>
              <div className="stats">
                <div><small>Running</small><b><AnimatedNumber value={running} /></b></div>
                <div><small>Done</small><b><AnimatedNumber value={done} /></b></div>
                <div><small>Needs you</small><b className={attention ? "bad" : ""}><AnimatedNumber value={attention} /></b></div>
              </div>
              <div className="term"><span className="prompt">›</span> {latest ?? "Idle"}{running > 0 && <span className="caret">▌</span>}</div>
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
      <div className="offlineIcon">⚡</div>
      <h2>Bridge service is not running</h2>
      <p>
        This page only displays data. The Bridge runs on your machine (<code>{API}</code>) and reads
        your <code>data/</code> folder. Install and start it, then this page reconnects automatically:
      </p>
      <pre>{`git clone https://github.com/quocchungthan/PARA-AI-solution
cd PARA-AI-solution/src/Bridge
dotnet run`}</pre>
      <p className="sub">
        Started it and still offline? Your browser may have asked to allow this site to reach devices on your
        local network: choose Allow (or enable it in the site settings for this page).
      </p>
      <div className="retry"><span className="spinner" /> retrying every few seconds…</div>
    </div>
  );
}

function Search() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== ref.current) { e.preventDefault(); ref.current?.focus(); }
      if (e.key === "Escape" && document.activeElement === ref.current) { query.value = ""; ref.current?.blur(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <label className="search">
      <span>⌕</span>
      <input ref={ref} value={query.value} onChange={(e) => (query.value = e.target.value)} placeholder="Search sessions…" />
      {query.value ? <button onClick={() => (query.value = "")}>✕</button> : <kbd>/</kbd>}
    </label>
  );
}

function Skeleton() {
  return (
    <div className="kpis">{Array.from({ length: 6 }, (_, i) => <div key={i} className="kpi skel" />)}</div>
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

  return (
    <>
      <header>
        <div className="brand">
          <span className={`logo ${c.running ? "spinLogo" : ""}`}>⬡</span>
          <div><strong>Bridge</strong><small>Agent Mission Control</small></div>
        </div>
        <span className={`pill ${online ? "up" : online === false ? "down" : ""}`}>
          <i className="dot" /> {online === null ? "Connecting…" : online ? "Local service online" : "Service offline"}
        </span>
        {online && lastPass && <span className="pill">Scan {lastPass}</span>}
        <div className="spacer" />
        {online && <Search />}
        <span className="clock">{time}</span>
        <button className="icon" onClick={toggleTheme} title="Toggle theme">{isDark ? "☾" : "☀"}</button>
        {online && (c.running
          ? <i key={pollCount.value} className="tick" />
          : <i className="tick idle"           title="Paused: no task running" />)}      </header>
      <main>
        {online === null && <Skeleton />}
        {online === false && <Offline />}
        {online && snapshot.value && (
          <>
            <div className="kpis">
              <Kpi i={0} icon="◎" label="Sessions" value={total} hint={`${c.running} running now`} k="total" color="#3b82f6" />
              <Kpi i={1} icon="◔" label="Running" value={c.running} hint="working sessions" k="running" color="#06b6d4" />
              <Kpi i={2} icon="◉" label="Needs you" value={c.attention} hint="blocked or human-only" k="attention" color="#ef4444" />
              <Kpi i={3} icon="▤" label="Queue" value={c.queue} hint="pending / waiting for input" k="queue" color="#eab308" />
              <Kpi i={4} icon="✓" label="Completed" value={c.done} hint={`${total ? Math.round((c.done / total) * 100) : 0}% of all sessions`} k="done" color="#10b981" />
              <Kpi i={5} icon="⇄" label="Open delegations" value={openDelegations.value} hint="handoffs awaiting result" k="delegations" color="#8b5cf6" />
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
      <Drawer />
    </>
  );
}
