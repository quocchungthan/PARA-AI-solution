import type { Assignment, Session } from "./store";
import { titleOf } from "./util";

export function assignmentColumn(a: Assignment) {
  if (a.workState === "queued") return "queued";
  if (a.workState === "running") return "running";
  if (["done", "failed", "cancelled"].includes(a.workState ?? "")) return "finished";
  return "waiting";
}

export function assignmentScope(a: Assignment) {
  if (a.accessMode === "read_only")
    return `Read-only scope: ${a.reads?.length ? a.reads.join(", ") : "Whole repository"}; no source writes`;
  return `Write scope: ${a.writes.length ? a.writes.join(", ") : "Exclusive repository (legacy/default)"}`;
}

export function linkedSessionTitle(s: Session, assignments: Assignment[] = []) {
  if (s.title && !s.title.startsWith("(") && !s.title.startsWith("Bridge message ")) return s.title;
  const linked = assignments.filter((a) => a.protocol === 2 && a.targetId === s.sessionId);
  return linked.find((a) => !["done", "failed", "cancelled"].includes(a.workState ?? ""))?.title ||
    linked.at(-1)?.title || titleOf(s);
}

export function sessionExecution(s: Session) {
  if (s.state === "needs_human" || s.needs.some((n) => n.resolver === "human")) return "Needs your input";
  if (s.state === "working") return s.stale || s.silent ? "Working reported; activity stale" : "Working reported";
  if (s.state === "pending") return "Pending; not executing";
  if (s.state === "waiting_input") return "Waiting; not executing";
  return s.state.replaceAll("_", " ");
}

export const TASK_PHASES = [
  { key: "analysis", label: "Analyze" },
  { key: "approval", label: "Your approval" },
  { key: "implementation", label: "Implement" },
  { key: "review", label: "Review" },
  { key: "delivered", label: "Delivered locally" },
] as const;

export function tasksInPhase(sessions: Session[], phase: string) {
  return sessions.filter((s) => s.phase === phase && s.registered !== false &&
      (phase !== "delivered" || s.state === "done" && !!s.result?.trim()))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}
