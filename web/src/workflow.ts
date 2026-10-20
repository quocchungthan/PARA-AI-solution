import type { Session } from "./store";

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
