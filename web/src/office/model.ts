import type { Snapshot, Session } from "../store";
import type { SessionPresentation } from "./types";
import { OFFICE_ROLES, officeRole } from "./roles";
import { agentOf } from "../sessionAgent";
import type { AgentSummary, SharedOfficeModel, SharedOfficeNotice } from "./types";
export function presentSession(s: Session): SessionPresentation {
  const needsHuman =
    s.state !== "done" &&
    (s.state === "needs_human" || s.needs.some((n) => n.resolver === "human"));
  const activity: SessionPresentation["activity"] =
    (
      {
        working: "working",
        pending: "pending",
        waiting_input: "waiting",
        blocked: "blocked",
        needs_human: "needs-human",
        done: "done",
      } as const
    )[s.state] ?? "unknown";
  return {
    state: s.state,
    activity,
    needsHuman,
    healthIssues: [
      ...new Set([
        ...(s.issues ?? []),
        ...(s.stale ? ["Stale update"] : []),
        ...(s.silent ? ["Silent session"] : []),
      ]),
    ],
    verified: s.registered !== false && agentOf(s) !== "unassigned",
  };
}

export function deriveSharedOfficeModel(snapshot: Snapshot): SharedOfficeModel {
  const sessionsById = new Map(snapshot.sessions.map(s => [s.sessionId, s]));
  const sessionIds = [...sessionsById.keys()].sort();
  const delegations = [...new Map(snapshot.delegations.map(d => [d.key, d])).values()]
    .sort((a, b) => a.key.localeCompare(b.key));
  const agents = new Set<string>([...OFFICE_ROLES, ...(snapshot.roles ?? []), ...sessionIds.map(id => agentOf(sessionsById.get(id)!))]);
  const departments: AgentSummary[] = [...agents].sort().map(agent => {
    const ids = sessionIds.filter(id => agentOf(sessionsById.get(id)!) === agent);
    const ps = ids.map(id => presentSession(sessionsById.get(id)!));
    const working = ps.filter(p => p.activity === "working").length;
    const waiting = ps.filter(p => ["waiting", "pending", "blocked"].includes(p.activity)).length;
    const unfinished = ids.filter(id => sessionsById.get(id)!.state !== "done").length;
    const needsHuman = ps.filter(p => p.needsHuman).length;
    return {
      agent, role: officeRole(agent), sessionIds: ids, working, waiting, unfinished, needsHuman,
      healthIssues: ps.filter(p => p.healthIssues.length).length,
      activity: needsHuman ? "needs-human" : working ? "working" : waiting ? "waiting" : unfinished ? "unknown" : "idle"
    };
  });
  const diagnostics: SharedOfficeModel["diagnostics"][number][] = [];
  const pendingAssignments: SharedOfficeModel["pendingAssignments"][number][] = [];
  const children = new Map<string, string[]>();
  for (const d of delegations) {
    if (!["assigned", "result_fed"].includes(d.status)) continue;
    for (const id of new Set([d.originId, d.targetId]))
      if (!sessionsById.has(id)) diagnostics.push({
        delegationKey: d.key,
        sessionId: sessionsById.has(d.originId) ? d.originId : sessionsById.has(d.targetId) ? d.targetId : undefined,
        message: `Recorded handoff ${d.key}: absent session ${id}`
      });
    if (!sessionsById.has(d.targetId)) pendingAssignments.push({ delegationKey: d.key, targetId: d.targetId });
    children.set(d.originId, [...(children.get(d.originId) ?? []), d.targetId]);
  }
  // Iterative strongly connected components include every member of overlapping cycles.
  const seen = new Set<string>(), order: string[] = [], reverse = new Map<string, string[]>();
  for (const [parent, targets] of children)
    for (const target of targets) reverse.set(target, [...(reverse.get(target) ?? []), parent]);
  for (const start of children.keys()) {
    if (seen.has(start)) continue;
    const stack: { id: string; cursor: number }[] = [{ id: start, cursor: 0 }];
    seen.add(start);
    while (stack.length) {
      const frame = stack.at(-1)!, next = (children.get(frame.id) ?? [])[frame.cursor++];
      if (next === undefined) { order.push(frame.id); stack.pop(); }
      else if (!seen.has(next)) { seen.add(next); stack.push({ id: next, cursor: 0 }); }
    }
  }
  seen.clear();
  const cyclic = new Set<string>();
  for (const start of order.reverse()) {
    if (seen.has(start)) continue;
    const component: string[] = [], pending = [start];
    seen.add(start);
    while (pending.length) {
      const id = pending.pop()!;
      component.push(id);
      for (const parent of reverse.get(id) ?? [])
        if (!seen.has(parent)) { seen.add(parent); pending.push(parent); }
    }
    if (component.length > 1 || children.get(start)?.includes(start))
      for (const id of component) cyclic.add(id);
  }
  for (const id of [...cyclic].sort())
    if (sessionsById.has(id)) diagnostics.push({ sessionId: id, message: "Recorded delegation cycle; session remains included." });
  const ps = sessionIds.map(id => presentSession(sessionsById.get(id)!));
  return {
    sessionIds, sessionsById, departments, delegations, diagnostics, pendingAssignments, counts: {
      working: ps.filter(p => p.activity === "working").length,
      unfinished: sessionIds.filter(id => sessionsById.get(id)!.state !== "done").length,
      needsHuman: ps.filter(p => p.needsHuman).length,
      healthIssues: ps.filter(p => p.healthIssues.length).length,
      failedHandoffs: delegations.filter(d => ["failed", "limit_reached"].includes(d.status)).length,
    }
  };
}

export function deriveSharedOfficeNotices(model: SharedOfficeModel): readonly SharedOfficeNotice[] {
  const notices: SharedOfficeNotice[] = [];
  for (const id of model.sessionIds) {
    const s = model.sessionsById.get(id)!, p = presentSession(s);
    if (p.needsHuman) notices.push({
      id: JSON.stringify(["human", id, s.question, s.needs.filter(n => n.resolver === "human")]),
      sessionId: id, kind: "human", label: `Needs you · ${sessionTitle(s)}`
    });
    if (p.healthIssues.length) notices.push({
      id: JSON.stringify(["health", id, p.healthIssues]),
      sessionId: id, kind: "health", label: `Health · ${sessionTitle(s)} · ${p.healthIssues.join(", ")}`
    });
  }
  for (const d of model.delegations) {
    if (["failed", "limit_reached"].includes(d.status)) notices.push({
      id: JSON.stringify(["handoff", d.key, d.status]),
      sessionId: model.sessionsById.has(d.originId) ? d.originId : model.sessionsById.has(d.targetId) ? d.targetId : null,
      kind: "handoff", label: `Handoff ${d.status === "failed" ? "failed" : "limited"} · ${d.originId} → ${d.targetId}`,
    });
    else if (["assigned", "result_fed"].includes(d.status) &&
      (!model.sessionsById.has(d.originId) || !model.sessionsById.has(d.targetId))) notices.push({
        id: JSON.stringify(["pending", d.key, d.status]),
        sessionId: model.sessionsById.has(d.originId) ? d.originId : model.sessionsById.has(d.targetId) ? d.targetId : null,
        kind: "handoff", label: `Handoff · ${d.originId} → ${d.targetId} · awaiting session record`,
      });
  }
  return notices;
}
export const sessionTitle = (s: Session) =>
  s.title?.trim() || s.task?.trim().slice(0, 70) || s.sessionId.slice(0, 12);
