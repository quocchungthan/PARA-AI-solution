import type { Session, Snapshot, Delegation } from "../../src/store";
export const session = (
  sessionId: string,
  agent = "coder",
  state = "working",
  overrides: Partial<Session> = {},
): Session => ({
  sessionId,
  agent,
  state,
  needs: [],
  attempts: 0,
  progress: [],
  registered: true,
  updatedAt: "2026-10-17T01:00:00Z",
  task: `Task ${sessionId}`,
  ...overrides,
});
export const delegation = (
  key: string,
  originId: string,
  targetId: string,
  status = "assigned",
): Delegation => ({ key, originId, targetId, status });
export const snapshot = (
  sessions: Session[] = [],
  delegations: Delegation[] = [],
  overrides: Partial<Snapshot> = {},
): Snapshot => ({
  now: "2026-10-17T01:00:00Z",
  sessions,
  delegations,
  humanQueue: [],
  log: [],
  ...overrides,
});
export const populated = (count = 10) =>
  snapshot(
    [
      session("main", "coordinator", "working", {
        title: "Build botanical office",
      }),
      ...Array.from({ length: count }, (_, i) =>
        session(
          `worker-${i}`,
          [
            "coder",
            "researcher",
            "reviewer",
            "functional-reviewer",
            "hr",
            "scrum-master",
          ][i % 6],
        ),
      ),
    ],
    Array.from({ length: count }, (_, i) =>
      delegation(`link-${i}`, "main", `worker-${i}`),
    ),
  );
export const multiConversation = () => snapshot([
  session("a", "coordinator"), session("b", "coordinator"),
  session("nested", "coordinator"), session("shared", "reviewer"),
  session("standalone"), session("custom", "designer"),
  session("unassigned", "unknown"), session("history", "coder", "done"),
], [
  delegation("an", "a", "nested"), delegation("ns", "nested", "shared"),
  delegation("bs", "b", "shared"), delegation("bs2", "b", "shared"),
], { roles: ["designer", "researcher"] });
