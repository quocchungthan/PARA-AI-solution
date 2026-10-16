import type { Session } from "./store";

// Graphite tones defined per theme in styles.css; identity comes mainly from the role icon.
const TONES = 6;

export function colorOf(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(--tone-${h % TONES})`;
}

export const initials = (name: string) =>
  name.split(/[\s\-_]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export function ago(iso?: string, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const STATE_COLOR: Record<string, string> = {
  working: "var(--ok)", done: "var(--ok)", blocked: "var(--warn)", needs_human: "var(--warn)",
  waiting_input: "var(--warn)", pending: "var(--muted)",
};

export const stateLabel = (s: Session) =>
  s.registered === false && s.state === "done" ? "unregistered" : s.state.replace("_", " ");

const ROLES: Record<string, string> = {
  coordinator: "orchestrator", coder: "implementation", researcher: "investigation",
  reviewer: "quality gate", "scrum-master": "coaching", unassigned: "no agent set",
};
export const roleOf = (name: string) => ROLES[name] ?? "agent";

// Ice-blue action label for sessions that need a human decision.
export function actionOf(s: Session) {
  if (s.state === "done" || s.state === "working" || s.state === "pending") return null;
  if (/\bapprov/i.test(s.question ?? "")) return "Approve";
  if (s.question) return "Answer";
  return "Review";
}

export const titleOf = (s: Session) =>
  s.title && !s.title.startsWith("(") ? s.title : s.task?.slice(0, 70) ?? "(untitled)";

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
