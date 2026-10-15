import { signal, computed, effect } from "@preact/signals-react";

const history_ = window.history;

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
export const query = signal("");
export const openSession = signal<string | null>(null);
export const pollCount = signal(0);
// sessionId -> time (ms) its updatedAt last changed, drives the "just changed" flash.
export const changedAt = signal<Record<string, number>>({});

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
export const visibleSessions = computed(() => {
  const q = query.value.trim().toLowerCase();
  return sessions.value.filter((s) =>
    (!selectedAgent.value || agentOf(s) === selectedAgent.value) &&
    (!q || [s.sessionId, s.title, s.task, agentOf(s), s.state].some((v) => v?.toLowerCase().includes(q))));
});
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

let started = false;

// Polling with a hard timeout: a blocked or unanswered request (e.g. a pending browser
// local-network permission prompt) ends as "offline" instead of "connecting" forever.
async function poll() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`${API}/api/snapshot`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    const snap = (await r.json()) as Snapshot;
    const prev = snapshot.value;
    if (prev) {
      const before = new Map(prev.sessions.map((s) => [s.sessionId, s.updatedAt]));
      const now = Date.now();
      const next = { ...changedAt.value };
      for (const s of snap.sessions) if (before.get(s.sessionId) !== s.updatedAt) next[s.sessionId] = now;
      changedAt.value = next;
    }
    snapshot.value = snap;
    serviceOnline.value = true;
    pollCount.value++;
    pushHistory(snap);
  } catch {
    serviceOnline.value = false;
  } finally {
    clearTimeout(timer);
  }
}

export function connect() {
  if (started) return;
  started = true;
  // Deep link: #session=<id> opens the detail drawer; kept in sync both ways.
  const fromHash = () => (openSession.value = new URLSearchParams(location.hash.slice(1)).get("session"));
  fromHash();
  window.addEventListener("hashchange", fromHash);
  effect(() => {
    const id = openSession.value;
    const want = id ? `#session=${id}` : "";
    if (location.hash !== want) history_.replaceState(null, "", want || location.pathname + location.search);
  });
  const loop = async () => {
    await poll();
    setTimeout(loop, serviceOnline.value ? 2000 : 4000);
  };
  loop();
  setInterval(() => (clock.value = new Date()), 1000);
}

export function toggleTheme() {
  dark.value = !dark.value;
  localStorage.setItem("bridge-theme", dark.value ? "dark" : "light");
}
