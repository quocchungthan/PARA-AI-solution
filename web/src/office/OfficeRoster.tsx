import type { SharedOfficeRuntime, SharedOfficeSelection } from "./types";
import { ROLE_NAMES } from "./roles";
import { presentSession, sessionTitle } from "./model";
export function OfficeRoster({ runtime, onSelect, onReveal }: {
  runtime: SharedOfficeRuntime;
  onSelect: (selection: SharedOfficeSelection) => void;
  onReveal: (sessionId: string) => void;
}) {
  const { model, workers } = runtime;
  const live = model.sessionIds.filter(id => model.sessionsById.get(id)!.state !== "done");
  const represented = live.filter(id => workers.some(w => w.sessionId === id)).length;
  return (
    <div className="officeRoster" aria-label="Office roster">
      <div className="officePeople">
        <button onClick={() => onSelect({ kind: "human" })}>You · manager</button>
        {model.departments.map(d => (
          <button key={d.agent}
            aria-label={d.role === "coordinator" ? "Executive assistant" : d.role === "unknown" ? `${d.agent} role` : `${ROLE_NAMES[d.role]} lead`}
            onClick={() => onSelect({ kind: "department", agent: d.agent })}>
            {d.role === "unknown" ? d.agent : ROLE_NAMES[d.role]}
            <small>{d.working} working</small>
          </button>
        ))}
      </div>
      <details className="officeSessionList" open>
        <summary>Sessions · {live.length} live · {represented} in 3D · {live.length - represented} list only</summary>
        <div>
          {model.sessionIds.map(id => {
            const s = model.sessionsById.get(id)!, p = presentSession(s);
            const visible = workers.some(w => w.sessionId === id);
            return (
              <button key={id} className={`officeSession status-${p.activity}`}
                aria-label={`Worker ${sessionTitle(s)} · ${p.activity}`}
                onClick={() => { onReveal(id); onSelect({ kind: "session", sessionId: id }); }}>
                <span>{sessionTitle(s)}</span>
                <small>{s.agent || "unassigned"} · {p.activity}
                  {p.needsHuman ? " · needs you" : ""}
                  {p.healthIssues.length ? " · health issue" : ""}
                  {!p.verified ? " · unverified" : ""}
                  {!visible && s.state !== "done" ? " · list only" : ""}
                </small>
              </button>
            );
          })}
          {model.sessionIds.length === 0 && <p>No sessions yet.</p>}
        </div>
      </details>
    </div>
  );
}
