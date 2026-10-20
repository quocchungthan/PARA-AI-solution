import { useEffect, useRef } from "react";
import type { SharedOfficeRuntime, SharedOfficeSelection } from "./types";
import { ROLE_DUTIES, ROLE_NAMES, officeRole } from "./roles";
import { presentSession, sessionTitle } from "./model";
export function OfficeDetails({
  runtime,
  onSelect,
  onClose,
  onOpenSession,
}: {
  runtime: SharedOfficeRuntime;
  onSelect: (s: SharedOfficeSelection) => void;
  onClose: () => void;
  onOpenSession: (id: string) => void;
}) {
  const selection = runtime.selection;
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const invoker = useRef<HTMLElement | null>(null);
  closeRef.current = onClose;
  const close = () => {
    closeRef.current();
    if (invoker.current?.isConnected)
      invoker.current.focus({ preventScroll: true });
    else
      document
        .querySelector<HTMLButtonElement>(
          ".officeView button[aria-pressed=true]",
        )
        ?.focus();
  };
  useEffect(() => {
    if (!selection) return;
    if (!ref.current?.contains(document.activeElement))
      invoker.current = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.contains(document.activeElement)) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [
    selection?.kind,
    selection?.kind === "session"
      ? selection.sessionId
      : selection?.kind === "department"
        ? selection.agent
        : "",
  ]);
  if (!selection) return null;
  let content;
  if (selection.kind === "human")
    content = (
      <>
        <h3>You · manager</h3>
        <p>
          You collaborate with the executive assistant to shape the plan. This
          avatar represents you; it does not report your presence or approvals.
        </p>
      </>
    );
  else if (selection.kind === "department") {
    const d = runtime.model.departments.find((d) => d.agent === selection.agent);
    const role = officeRole(selection.agent);
    content = (
      <>
        <h3>{role === "unknown" ? selection.agent : ROLE_NAMES[role]}</h3>
        <p className="officeEyebrow">Department representative</p>
        <p>{role === "unknown" ? "Sessions grouped by their recorded agent role. No dedicated room mapping." : ROLE_DUTIES[role]}</p>
        <p>
          {d?.working ?? 0} working · {d?.waiting ?? 0} waiting ·{" "}
          {d?.needsHuman ?? 0} need you · {d?.healthIssues ?? 0} health issues
        </p>
        <p>
          This summary covers all sessions for this role. Permanent representatives
          are not separate agent sessions.
        </p>
        {d?.sessionIds.map((id) => (
          <button
            key={id}
            onClick={() =>
              onSelect({
                kind: "session",
                sessionId: id,
              })
            }
          >
            {sessionTitle(runtime.model.sessionsById.get(id)!)}
          </button>
        ))}
      </>
    );
  } else {
    const s = runtime.model.sessionsById.get(selection.sessionId);
    if (!s)
      content = (
        <>
          <h3>Session unavailable</h3>
          <p>{selection.sessionId}</p>
          <p>
            The record is absent from the latest snapshot. This does not
            indicate completion.
          </p>
        </>
      );
    else {
      const p = presentSession(s),
        parents = runtime.model.delegations.filter(
          (d) =>
            d.targetId === s.sessionId &&
            ["assigned", "result_fed"].includes(d.status),
        );
      content = (
        <>
          <p className="officeEyebrow">
            Session worker{" "}
            · {s.agent ?? "unknown"}
          </p>
          <h3>{sessionTitle(s)}</h3>
          <p className={`officeStatus status-${p.activity}`}>
            {p.activity} · source: {p.state}
            {p.needsHuman ? " · needs your input" : ""}
          </p>
          {!p.verified && (
            <p>Unverified source: agent name is missing or registration is not verified.</p>
          )}
          {p.healthIssues.map((issue) => (
            <p key={issue} className="officeWarning">
              Health · {issue}
            </p>
          ))}
          <p>{s.task}</p>
          {runtime.model.diagnostics.filter(d => d.sessionId === s.sessionId).map((d, i) => <p className="officeWarning" key={i}>{d.message}</p>)}
          {parents.length > 0 && (
            <>
              <h4>Delegated by</h4>
              {[...new Set(parents.map((d) => d.originId))].map((id) => (
                <p key={id}>
                  {runtime.model.sessionsById.has(id)
                    ? sessionTitle(runtime.model.sessionsById.get(id)!)
                    : id}
                </p>
              ))}
            </>
          )}
          {s.question && (
            <>
              <h4>Question</h4>
              <p>{s.question}</p>
            </>
          )}
          {s.needs.length > 0 && (
            <>
              <h4>Needs</h4>
              {s.needs.map((n, i) => (
                <p key={i}>
                  {n.resolver}: {n.text}
                </p>
              ))}
            </>
          )}
          {s.progress.length > 0 && (
            <>
              <h4>Recent progress</h4>
              <ol>
                {s.progress.slice(-8).map((p, i) => (
                  <li key={i}>{p.note}</li>
                ))}
              </ol>
            </>
          )}
          {s.result && (
            <>
              <h4>Result / evidence</h4>
              <p className="officePre">{s.result}</p>
            </>
          )}
          {runtime.model.delegations
            .filter((d) => d.originId === s.sessionId)
            .map((d) => (
              <p key={d.key}>
                Handoff · {d.targetId} · {d.status}
                {d.attempts ? ` · ${d.attempts} attempt(s)` : ""}
                {d.nextAttemptAt ? ` · retry at ${new Date(d.nextAttemptAt).toLocaleTimeString()}` : ""}
                {!runtime.model.sessionsById.has(d.targetId) &&
                  ["assigned", "result_fed"].includes(d.status)
                  ? " · awaiting session record"
                  : ""}
                {d.lastError ? ` · last error: ${d.lastError}` : ""}
              </p>
            ))}
          <button
            className="officePrimary"
            onClick={() => onOpenSession(s.sessionId)}
          >
            Open session
          </button>
        </>
      );
    }
  }
  return (
    <aside
      className="officeDetails"
      aria-label="Office observation"
      tabIndex={-1}
      ref={ref}
    >
      <button
        className="officeClose"
        aria-label="Close observation"
        onClick={close}
      >
        ×
      </button>
      {content}
    </aside>
  );
}
