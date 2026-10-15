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
  stale?: boolean;
  issues?: string[];
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

export type Page = "overview" | "sessions" | "agents";
export const PAGES: Page[] = ["overview", "sessions", "agents"];
export const page = signal<Page>("overview");
// Session card outlined in blue after following a notification.
export const highlighted = signal<string | null>(null);

export type Notice = { id: string; sessionId: string; title: string; agent: string; at: number; read: boolean };
export const notices = signal<Notice[]>([]);
export const unread = computed(() => notices.value.filter((n) => !n.read).length);
export const toast = signal<Notice | null>(null);

export function goToSession(sessionId: string) {
  notices.value = notices.value.map((n) => (n.sessionId === sessionId ? { ...n, read: true } : n));
  toast.value = null;
  selectedAgent.value = null;
  query.value = "";
  page.value = "sessions";
  highlighted.value = sessionId;
}

export const markAllRead = () => (notices.value = notices.value.map((n) => ({ ...n, read: true })));
// sessionId -> time (ms) its updatedAt last changed, drives the "just changed" flash.
export const changedAt = signal<Record<string, number>>({});

export type Column = "queue" | "running" | "attention" | "done";
export const columnOf = (s: Session): Column =>
  s.stale || (s.issues?.length ?? 0) > 0 ? "attention"
  : s.state === "working" ? "running"
  : s.state === "done" ? "done"
  : s.state === "blocked" || s.state === "needs_human" ? "attention"
  : "queue";

export const agentOf = (s: Session) => (s.agent && s.agent !== "unknown" ? s.agent : "unassigned");
export const needsHumanInput = (s: Session) =>
  s.state === "needs_human" || (s.state !== "done" && s.needs.some((n) => n.resolver === "human"));

export async function sendHumanReply(sessionId: string, message: string) {
  const response = await fetch(`${API}/api/sessions/${encodeURIComponent(sessionId)}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const result = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? result?.detail ?? `Reply failed (${response.status}).`);
}

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

// Session ids already known to this browser, so tasks created while the page was closed still notify.
const SEEN_KEY = "bridge-seen-sessions";
let seen: Set<string> | null = null;
function detectNewTasks(snap: Snapshot) {
  const ids = snap.sessions.map((s) => s.sessionId);
  if (!seen) {
    let stored: string[] | null = null;
    try { stored = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null"); } catch { /* corrupt entry: start fresh */ }
    seen = new Set(Array.isArray(stored) ? stored : ids);
  }
  const fresh = snap.sessions.filter((s) => !seen!.has(s.sessionId));
  ids.forEach((id) => seen!.add(id));
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  if (!fresh.length) return;
  const at = Date.now();
  const added = fresh.map((s): Notice => ({
    id: `${s.sessionId}-${at}`, sessionId: s.sessionId, agent: agentOf(s), at, read: false,
    title: s.title && !s.title.startsWith("(") ? s.title : s.task?.slice(0, 80) ?? s.sessionId.slice(0, 8),
  }));
  notices.value = [...added.reverse(), ...notices.value].slice(0, 30);
  toast.value = added[0];
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
    detectNewTasks(snap);
    snapshot.value = snap;
    serviceOnline.value = true;
    pollCount.value++;
  } catch {
    serviceOnline.value = false;
  } finally {
    clearTimeout(timer);
  }
}

export function connect() {
  if (started) return;
  started = true;
  // Deep link: #view=<page>&session=<id> selects the tab and opens the drawer; kept in sync both ways.
  const fromHash = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    const view = params.get("view") as Page | null;
    page.value = view && PAGES.includes(view) ? view : "overview";
    openSession.value = params.get("session");
  };
  fromHash();
  window.addEventListener("hashchange", fromHash);
  effect(() => {
    const params = new URLSearchParams();
    if (page.value !== "overview") params.set("view", page.value);
    if (openSession.value) params.set("session", openSession.value);
    const hash = params.toString();
    const want = hash ? `#${hash}` : "";
    if (location.hash !== want) history_.replaceState(null, "", want || location.pathname + location.search);
  });
  effect(() => {
    if (page.value !== "sessions") highlighted.value = null;
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
