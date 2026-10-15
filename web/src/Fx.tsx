import { useEffect, useRef, useState } from "react";
import { agentOf, changedAt, clock, openSession, sessions } from "./store";
import { STATE_COLOR, ago, roleOf, stateLabel } from "./util";
import { AgentGlyph } from "./Glyph";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tweens from the previous value to the new one so KPI changes are visible.
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced() || from.current === value) { from.current = value; setShown(value); return; }
    const start = performance.now(), a = from.current, d = 600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / d), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

export const isFresh = (id: string) => clock.value.getTime() - (changedAt.value[id] ?? 0) < 4000;

export function Drawer() {
  const id = openSession.value;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (openSession.value = null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const s = sessions.value.find((x) => x.sessionId === id);
  const now = clock.value.getTime();
  const name = s ? agentOf(s) : "";
  return (
    <>
      <div className={`scrim ${s ? "open" : ""}`} onClick={() => (openSession.value = null)} />
      <aside className={`drawer ${s ? "open" : ""}`} aria-hidden={!s}>
        {s && (
          <>
            <div className="drawerHead">
              <AgentGlyph name={name} size="lg" />
              <div className="grow">
                <strong>{name} <small className="role">{roleOf(name)}</small></strong>
                <small className="id copy" title="Copy session id" onClick={() => navigator.clipboard?.writeText(s.sessionId)}>
                  {s.sessionId} ⧉
                </small>
              </div>
              <span className="badge" style={{ color: STATE_COLOR[s.state], borderColor: STATE_COLOR[s.state] }}>
                {s.state === "working" && <i className="dot" />} {stateLabel(s)}
              </span>
              <button className="icon" onClick={() => (openSession.value = null)} title="Close (Esc)">✕</button>
            </div>
            <h2 className="drawerTitle">{s.title && !s.title.startsWith("(") ? s.title : "(untitled)"}</h2>
            <div className="meta">
              {s.taskType && <span className="chip">{s.taskType}</span>}
              <span className="chip">updated {ago(s.updatedAt, now)}</span>
              {s.attempts > 0 && <span className="chip">{s.attempts} attempts</span>}
            </div>
            {s.question && <div className="callout warn"><b>Question</b><p>{s.question}</p></div>}
            {s.needs.length > 0 && (
              <div className="callout bad"><b>Needs</b>
                <ul>{s.needs.map((n, i) => <li key={i}>{n.text} <small>· {n.resolver}</small></li>)}</ul>
              </div>
            )}
            {s.result && <div className="callout ok"><b>Result</b><p>{s.result}</p></div>}
            {s.handoff && (
              <div className="callout"><b>Handoff → {s.handoff.agent ?? s.handoff.target}</b><p>{s.handoff.prompt}</p></div>
            )}
            <h4>Progress</h4>
            <ol className="timeline">
              {[...s.progress].reverse().map((p, i) => (
                <li key={i} style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="when">{ago(p.ts, now)}</span>
                  <span>{p.note}</span>
                </li>
              ))}
            </ol>
            {s.task && (<><h4>Task</h4><p className="taskText">{s.task}</p></>)}
          </>
        )}
      </aside>
    </>
  );
}
