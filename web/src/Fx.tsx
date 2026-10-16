import { useEffect, useRef, useState, type FormEvent } from "react";
import { agentOf, changedAt, clock, fetchInspection, needsHumanInput, openSession, sendHumanReply, sessions, type Inspection } from "./store";
import { STATE_COLOR, ago, roleOf, stateLabel } from "./util";
import { AgentGlyph } from "./Glyph";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Live look into the session's own Copilot event log, refreshed while the drawer is open.
function InspectorPanel({ sessionId }: { sessionId: string }) {
  const [info, setInfo] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setInfo(null);
    setError(null);
    const load = () => fetchInspection(sessionId)
      .then((r) => alive && (setInfo(r), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Inspect failed"));
    void load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [sessionId]);
  const now = clock.value.getTime();
  const stuck = info?.available && (info.silent || /^Stuck/.test(info.diagnosis));
  return (
    <>
      <h4>Inspector</h4>
      {error && <div className="callout bad"><p>{error}</p></div>}
      {!info && !error && <p className="taskText">Reading event log…</p>}
      {info && (
        <div className="inspector">
          <div className={`callout ${stuck ? "bad" : info.available ? "ok" : ""}`}><p>{info.diagnosis}</p></div>
          {info.available && (
            <>
              <div className="meta">
                <span className="chip">last event {info.lastEventAt ? ago(info.lastEventAt, now) : "unknown"}</span>
                {info.lastEventType && <span className="chip">{info.lastEventType}</span>}
                {!!info.pendingPermissions && <span className="chip">{info.pendingPermissions} pending permission</span>}
                {!!info.failedPermissionPrompts && <span className="chip">{info.failedPermissionPrompts} failed prompts</span>}
                {!!info.failedToolCalls && <span className="chip">{info.failedToolCalls} failed tools</span>}
              </div>
              <ol className="timeline">
                {[...(info.recent ?? [])].reverse().slice(0, 15).map((e, i) => (
                  <li key={i}>
                    <span className="when">{ago(e.at, now)}</span>
                    <span><b>{e.type}</b>{e.detail ? ` · ${e.detail}` : ""}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </>
  );
}

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
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyQueued, setReplyQueued] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (openSession.value = null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    setReply("");
    setSending(false);
    setReplyError(null);
    setReplyQueued(false);
  }, [id]);
  const s = sessions.value.find((x) => x.sessionId === id);
  const now = clock.value.getTime();
  const name = s ? agentOf(s) : "";
  const canReply = s ? needsHumanInput(s) : false;
  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = reply.trim();
    if (!s || !canReply || !message || sending) return;

    const sessionId = s.sessionId;
    setSending(true);
    setReplyError(null);
    setReplyQueued(false);
    try {
      await sendHumanReply(sessionId, message);
      if (openSession.value === sessionId) {
        setReply("");
        setReplyQueued(true);
      }
    } catch (error) {
      if (openSession.value === sessionId)
        setReplyError(error instanceof Error ? error.message : "The reply could not be sent.");
    } finally {
      if (openSession.value === sessionId) setSending(false);
    }
  };
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
                <small className="id copy" title="Copy resume command" onClick={() => navigator.clipboard?.writeText(`copilot --allow-all --resume=${s.sessionId}`)}>
                  {s.sessionId} ⧉ copy resume command
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
            {canReply && (
              <>
                <h4>Reply to this session</h4>
                <form className="replyForm" onSubmit={(event) => void submitReply(event)}>
                  <label htmlFor="session-reply">Your response</label>
                  <textarea id="session-reply" value={reply} rows={4} maxLength={10000}
                    placeholder="Share the answer or decision this session needs…"
                    onChange={(event) => {
                      setReply(event.target.value);
                      setReplyQueued(false);
                      setReplyError(null);
                    }} />
                  {replyError && <div className="replyFeedback error" role="alert">{replyError}</div>}
                  {replyQueued && <div className="replyFeedback success" role="status">Reply queued. The Bridge will deliver it to the session.</div>}
                  <button type="submit" disabled={sending || !reply.trim()}>
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                </form>
              </>
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
            <InspectorPanel sessionId={s.sessionId} />
          </>
        )}
      </aside>
    </>
  );
}
