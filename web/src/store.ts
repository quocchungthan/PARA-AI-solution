import { signal, computed } from "@preact/signals-react";

// The backend is always the local Bridge service.
export const API = "http://localhost:5310";

export type Session = {
  sessionId: string; agent?: string; title?: string; taskType?: string; task?: string;
  state: string; needs: { text: string; resolver: string }[]; question?: string;
  attempts: number; progress: { ts?: string; note?: string }[]; result?: string;
  handoff?: { id: string; target: string; agent?: string; prompt: string } | null;
  updatedAt?: string;
};
export type Delegation = { key: string; originId: string; targetId: string; status: string; createdAt?: string };
export type Snapshot = {
  now: string; sessions: Session[]; delegations: Delegation[]; humanQueue: unknown; log: string[];
};

export const serviceOnline = signal<boolean | null>(null);
export const snapshot = signal<Snapshot | null>(null);
export const selectedAgent = signal<string | null>(null);
export const dark = signal(localStorage.getItem("bridge-theme") !== "light");
export const clock = signal(new Date());

export type Column = "queue" | "running" | "attention" | "done";
export const columnOf = (s: Session): Column =>
  s.state === "working" ? "running"
  : s.state === "done" ? "done"
  : s.state === "blocked" || s.state === "needs_human" ? "attention"
  : "queue";

export const agentOf = (s: Session) => (s.agent && s.agent !== "unknown" ? s.agent : "unassigned");

export const sessions = computed(() => snapshot.value?.sessions ?? []);
export const agents = computed(() => {
  const map = new Map<string, Session[]>();
  for (const s of sessions.value) map.set(agentOf(s), [...(map.get(agentOf(s)) ?? []), s]);
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
});
export const visibleSessions = computed(() =>
  selectedAgent.value ? sessions.value.filter((s) => agentOf(s) === selectedAgent.value) : sessions.value);
export const counts = computed(() => {
  const c = { queue: 0, running: 0, attention: 0, done: 0 };
  for (const s of sessions.value) c[columnOf(s)]++;
  return c;
});
export const openDelegations = computed(() =>
  (snapshot.value?.delegations ?? []).filter((d) => d.status === "assigned").length);

// Short rolling history per KPI for the sparklines.
export const history = signal<Record<string, number[]>>({});
function pushHistory(snap: Snapshot) {
  const c = { queue: 0, running: 0, attention: 0, done: 0 };
  for (const s of snap.sessions) c[columnOf(s)]++;
  const values: Record<string, number> = {
    total: snap.sessions.length, ...c,
    delegations: snap.delegations.filter((d) => d.status === "assigned").length,
  };
  const next = { ...history.value };
  for (const [k, v] of Object.entries(values)) next[k] = [...(next[k] ?? []), v].slice(-40);
  history.value = next;
}

let source: EventSource | null = null;

// EventSource reconnects on its own; onopen/onerror drive the online signal.
export function connect() {
  if (source) return;
  source = new EventSource(`${API}/api/stream`);
  source.onopen = () => (serviceOnline.value = true);
  source.onerror = () => (serviceOnline.value = false);
  source.onmessage = (e) => {
    serviceOnline.value = true;
    const snap = JSON.parse(e.data) as Snapshot;
    snapshot.value = snap;
    pushHistory(snap);
  };
  setInterval(() => (clock.value = new Date()), 1000);
}

export function toggleTheme() {
  dark.value = !dark.value;
  localStorage.setItem("bridge-theme", dark.value ? "dark" : "light");
}
