import type { Session } from "./store";

const PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#eab308", "#ef4444", "#06b6d4", "#ec4899"];

export function colorOf(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
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
  working: "var(--accent)", done: "var(--ok)", blocked: "var(--bad)", needs_human: "var(--bad)",
  waiting_input: "var(--warn)", pending: "var(--muted)",
};

export const stateLabel = (s: Session) => s.state.replace("_", " ");
