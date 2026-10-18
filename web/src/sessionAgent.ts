import type { Session } from "./store";

export const agentOf = (s: Session) =>
  s.agent && s.agent !== "unknown" ? s.agent : "unassigned";
