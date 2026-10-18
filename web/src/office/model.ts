import type { Snapshot, Session } from "../store";
import type { OfficeModel, OfficeFloor, SessionPresentation } from "./types";
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
    return { agent, role: officeRole(agent), sessionIds: ids, working, waiting, unfinished, needsHuman,
      healthIssues: ps.filter(p => p.healthIssues.length).length,
      activity: needsHuman ? "needs-human" : working ? "working" : waiting ? "waiting" : unfinished ? "unknown" : "idle" };
  });
  const diagnostics: SharedOfficeModel["diagnostics"][number][] = [];
  const pendingAssignments: SharedOfficeModel["pendingAssignments"][number][] = [];
  const children = new Map<string, string[]>();
  for (const d of delegations) {
    if (!["assigned", "result_fed"].includes(d.status)) continue;
    for (const id of new Set([d.originId, d.targetId]))
      if (!sessionsById.has(id)) diagnostics.push({ delegationKey: d.key,
        sessionId: sessionsById.has(d.originId) ? d.originId : sessionsById.has(d.targetId) ? d.targetId : undefined,
        message: `Recorded handoff ${d.key}: absent session ${id}` });
    if (!sessionsById.has(d.targetId)) pendingAssignments.push({ delegationKey: d.key, targetId: d.targetId });
    children.set(d.originId, [...(children.get(d.originId) ?? []), d.targetId]);
  }
  // Iterative DFS diagnoses cycles without gating membership or risking recursion depth.
  const color = new Map<string, number>(), cyclic = new Set<string>();
  for (const start of children.keys()) {
    if (color.has(start)) continue;
    const stack: { id: string; cursor: number }[] = [{ id: start, cursor: 0 }];
    color.set(start, 1);
    while (stack.length) {
      const frame = stack.at(-1)!, next = (children.get(frame.id) ?? [])[frame.cursor++];
      if (next === undefined) { color.set(frame.id, 2); stack.pop(); }
      else if (color.get(next) === 1) {
        for (const f of stack.slice(stack.findIndex(f => f.id === next))) cyclic.add(f.id);
      } else if (!color.has(next)) { color.set(next, 1); stack.push({ id: next, cursor: 0 }); }
    }
  }
  for (const id of [...cyclic].sort())
    if (sessionsById.has(id)) diagnostics.push({ sessionId: id, message: "Recorded delegation cycle; session remains included." });
  const ps = sessionIds.map(id => presentSession(sessionsById.get(id)!));
  return { sessionIds, sessionsById, departments, delegations, diagnostics, pendingAssignments, counts: {
    working: ps.filter(p => p.activity === "working").length,
    unfinished: sessionIds.filter(id => sessionsById.get(id)!.state !== "done").length,
    needsHuman: ps.filter(p => p.needsHuman).length,
    healthIssues: ps.filter(p => p.healthIssues.length).length,
    failedHandoffs: delegations.filter(d => ["failed", "limit_reached"].includes(d.status)).length,
  } };
}

export function deriveSharedOfficeNotices(model: SharedOfficeModel): readonly SharedOfficeNotice[] {
  const notices: SharedOfficeNotice[] = [];
  for (const id of model.sessionIds) {
    const s = model.sessionsById.get(id)!, p = presentSession(s);
    if (p.needsHuman) notices.push({ id: JSON.stringify(["human", id, s.question, s.needs.filter(n => n.resolver === "human")]),
      sessionId: id, kind: "human", label: `Needs you · ${sessionTitle(s)}` });
    if (p.healthIssues.length) notices.push({ id: JSON.stringify(["health", id, p.healthIssues]),
      sessionId: id, kind: "health", label: `Health · ${sessionTitle(s)} · ${p.healthIssues.join(", ")}` });
  }
  for (const d of model.delegations)
    if (["failed", "limit_reached"].includes(d.status)) notices.push({
      id: JSON.stringify(["handoff", d.key, d.status]),
      sessionId: model.sessionsById.has(d.originId) ? d.originId : model.sessionsById.has(d.targetId) ? d.targetId : null,
      kind: "handoff", label: `Handoff ${d.status === "failed" ? "failed" : "limited"} · ${d.originId} → ${d.targetId}`,
    });
  return notices;
}
export const sessionTitle = (s: Session) =>
  s.title?.trim() || s.task?.trim().slice(0, 70) || s.sessionId.slice(0, 12);
export type OfficeNotice = {
  id: string;
  floorId: string;
  sessionId: string;
  kind: "human" | "health" | "handoff";
  label: string;
};
export function deriveOfficeNotices(model: OfficeModel): OfficeNotice[] {
  const notices: OfficeNotice[] = [];
  for (const floor of model.floors) {
    for (const id of floor.sessionIds) {
      const s = model.sessionsById.get(id)!,
        p = presentSession(s);
      if (p.needsHuman)
        notices.push({
          id: JSON.stringify([
            "human",
            floor.rootId,
            id,
            s.question,
            s.needs.filter((n) => n.resolver === "human"),
          ]),
          floorId: floor.rootId,
          sessionId: id,
          kind: "human",
          label: `Needs you · ${floor.title} · ${sessionTitle(s)}`,
        });
      if (p.healthIssues.length)
        notices.push({
          id: JSON.stringify(["health", floor.rootId, id, p.healthIssues]),
          floorId: floor.rootId,
          sessionId: id,
          kind: "health",
          label: `Health · ${floor.title} · ${sessionTitle(s)} · ${p.healthIssues.join(", ")}`,
        });
    }
    for (const d of model.delegations.filter(
      (d) =>
        floor.sessionIds.includes(d.originId) &&
        ["failed", "limit_reached"].includes(d.status),
    ))
      notices.push({
        id: JSON.stringify(["handoff", floor.rootId, d.key, d.status]),
        floorId: floor.rootId,
        sessionId: d.originId,
        kind: "handoff",
        label: `Handoff ${d.status === "failed" ? "failed" : "limited"} · ${floor.title} · ${d.targetId}`,
      });
  }
  return notices;
}
export function deriveOfficeModel(snapshot: Snapshot): OfficeModel {
  const sessionsById = new Map(snapshot.sessions.map((s) => [s.sessionId, s]));
  const edges = snapshot.delegations.filter(
    (d) =>
      ["assigned", "result_fed"].includes(d.status) &&
      d.originId?.trim() &&
      d.targetId?.trim(),
  );
  const children = new Map<string, Set<string>>(),
    parents = new Map<string, Set<string>>();
  for (const d of edges) {
    if (!children.has(d.originId)) children.set(d.originId, new Set());
    children.get(d.originId)!.add(d.targetId);
    if (!parents.has(d.targetId)) parents.set(d.targetId, new Set());
    parents.get(d.targetId)!.add(d.originId);
  }
  // DFS over all IDs, including absent records: an absent ancestor must not turn a child into a root.
  const cycle = new Set<string>(),
    visited = new Set<string>(),
    stack: string[] = [],
    inStack = new Set<string>();
  function visit(id: string) {
    if (inStack.has(id)) {
      for (const v of stack.slice(stack.indexOf(id))) cycle.add(v);
      return;
    }
    if (visited.has(id)) return;
    inStack.add(id);
    stack.push(id);
    for (const c of children.get(id) ?? []) visit(c);
    stack.pop();
    inStack.delete(id);
    visited.add(id);
  }
  for (const id of new Set([...sessionsById.keys(), ...children.keys()]))
    visit(id);
  const invalid = new Set(cycle);
  const pending = [...cycle];
  while (pending.length) {
    for (const c of children.get(pending.pop()!) ?? [])
      if (!invalid.has(c)) {
        invalid.add(c);
        pending.push(c);
      }
  }
  const roots = snapshot.sessions.filter(
    (s) =>
      officeRole(s.agent) === "coordinator" &&
      s.registered !== false &&
      !invalid.has(s.sessionId) &&
      !parents.has(s.sessionId),
  );
  const membership = new Set<string>();
  const pendingAssignments: OfficeModel["pendingAssignments"][number][] = [];
  const floors: OfficeFloor[] = roots.map((root) => {
    const ids = new Set<string>(),
      todo = [root.sessionId],
      seen = new Set<string>();
    while (todo.length) {
      const id = todo.pop()!;
      if (seen.has(id) || invalid.has(id)) continue;
      seen.add(id);
      if (sessionsById.has(id)) {
        ids.add(id);
        membership.add(id);
      }
      for (const c of children.get(id) ?? []) todo.push(c);
    }
    const sessionIds = [
      root.sessionId,
      ...[...ids].filter((id) => id !== root.sessionId).sort(),
    ];
    for (const d of edges)
      if (ids.has(d.originId) && !sessionsById.has(d.targetId))
        pendingAssignments.push({
          floorId: root.sessionId,
          delegationKey: d.key,
          targetId: d.targetId,
        });
    const people = sessionIds.map((id) => sessionsById.get(id)!);
    const presentations = people.map(presentSession);
    const departments = [...OFFICE_ROLES, "unknown" as const].map((role) => {
      const ss = people.filter((s) => officeRole(s.agent) === role);
      const ps = ss.map(presentSession);
      return {
        role,
        sessionIds: ss.map((s) => s.sessionId),
        working: ps.filter((p) => p.activity === "working").length,
        waiting: ps.filter((p) =>
          ["waiting", "pending", "blocked"].includes(p.activity),
        ).length,
        needsHuman: ps.filter((p) => p.needsHuman).length,
        healthIssues: ps.filter((p) => p.healthIssues.length).length,
      };
    });
    const counts = {
      working: presentations.filter((p) => p.activity === "working").length,
      unfinished: people.filter((s) => s.state !== "done").length,
      needsHuman: presentations.filter((p) => p.needsHuman).length,
      healthIssues: presentations.filter((p) => p.healthIssues.length).length,
      failedHandoffs: snapshot.delegations.filter(
        (d) =>
          ids.has(d.originId) && ["failed", "limit_reached"].includes(d.status),
      ).length,
    };
    return {
      rootId: root.sessionId,
      title: sessionTitle(root),
      sessionIds,
      departments,
      counts,
      active: counts.unfinished > 0,
    };
  });
  floors.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      (Date.parse(sessionsById.get(b.rootId)?.updatedAt ?? "") || 0) -
        (Date.parse(sessionsById.get(a.rootId)?.updatedAt ?? "") || 0) ||
      a.rootId.localeCompare(b.rootId),
  );
  const ungrouped = snapshot.sessions.flatMap((s) => {
    const reason = invalid.has(s.sessionId)
      ? "Cyclic delegation or ambiguous cyclic ancestor"
      : !membership.has(s.sessionId)
        ? "No recorded path from a registered main coordinator"
        : !presentSession(s).verified
          ? "Unregistered session or unknown role; delegation membership only"
          : null;
    return reason ? [{ sessionId: s.sessionId, reason }] : [];
  });
  return {
    floors,
    ungrouped,
    sessionsById,
    delegations: snapshot.delegations,
    pendingAssignments,
  };
}
