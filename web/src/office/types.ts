import type { Session, Delegation } from "../store";
export type OfficeRole =
  | "coordinator"
  | "researcher"
  | "coder"
  | "reviewer"
  | "functional-reviewer"
  | "hr"
  | "scrum-master"
  | "unknown";
export type OfficeSelection =
  | null
  | { kind: "session"; floorId: string; sessionId: string }
  | { kind: "department"; floorId: string; role: OfficeRole }
  | { kind: "human"; floorId: string };
export type SessionPresentation = {
  state: string;
  activity:
    | "working"
    | "pending"
    | "waiting"
    | "blocked"
    | "needs-human"
    | "done"
    | "unknown";
  needsHuman: boolean;
  healthIssues: readonly string[];
  verified: boolean;
};
export type DepartmentSummary = {
  role: OfficeRole;
  sessionIds: readonly string[];
  working: number;
  waiting: number;
  needsHuman: number;
  healthIssues: number;
};
export type OfficeFloor = {
  rootId: string;
  title: string;
  sessionIds: readonly string[];
  departments: readonly DepartmentSummary[];
  counts: {
    working: number;
    unfinished: number;
    needsHuman: number;
    healthIssues: number;
    failedHandoffs: number;
  };
  active: boolean;
};
export type OfficeModel = {
  floors: readonly OfficeFloor[];
  ungrouped: readonly { sessionId: string; reason: string }[];
  sessionsById: ReadonlyMap<string, Session>;
  delegations: readonly Delegation[];
  pendingAssignments: readonly {
    floorId: string;
    delegationKey: string;
    targetId: string;
  }[];
};
export type Vec3 = readonly [number, number, number];
export type CameraPose = {
  position: Vec3;
  target: Vec3;
  zoom: number;
  homeZoom?: number;
  viewportWidth?: number;
};
export type OfficeCameraHandle = {
  home(): void;
  focusRoom(roomId: string): void;
};
export type WorkerSlot = {
  sessionId: string;
  seatId: string;
  identitySeed: string;
  phase: "entering" | "seated" | "reporting" | "leaving";
  phaseStartedAt: number;
};
export type OfficeEvent = {
  id: string;
  floorId: string;
  kind: "arrive" | "handoff" | "report" | "leave";
  sessionId: string;
  originId?: string;
  delegationKey?: string;
  createdAt: number;
  startedAt?: number;
};
export type FloorRuntime = {
  workers: readonly WorkerSlot[];
  queue: readonly OfficeEvent[];
  camera: CameraPose | null;
};
export type OfficeRuntime = {
  model: OfficeModel;
  selectedFloorId: string | null;
  selection: OfficeSelection;
  online: boolean;
  floors: ReadonlyMap<string, FloorRuntime>;
  notice?: string;
};

export type AgentSummary = {
  agent: string;
  role: OfficeRole;
  sessionIds: readonly string[];
  working: number;
  waiting: number;
  unfinished: number;
  needsHuman: number;
  healthIssues: number;
  activity: SessionPresentation["activity"] | "idle";
};
export type SharedOfficeModel = {
  sessionIds: readonly string[];
  sessionsById: ReadonlyMap<string, Session>;
  departments: readonly AgentSummary[];
  counts: OfficeFloor["counts"];
  delegations: readonly Delegation[];
  diagnostics: readonly { sessionId?: string; delegationKey?: string; message: string }[];
  pendingAssignments: readonly { delegationKey: string; targetId: string }[];
};
export type SharedOfficeSelection =
  | null
  | { kind: "human" }
  | { kind: "department"; agent: string }
  | { kind: "session"; sessionId: string };
export type SharedOfficeEvent = Omit<OfficeEvent, "floorId">;
export type SharedOfficeRuntime = {
  model: SharedOfficeModel;
  selection: SharedOfficeSelection;
  online: boolean;
  workers: readonly WorkerSlot[];
  queue: readonly SharedOfficeEvent[];
  camera: CameraPose | null;
};
export type SharedOfficeNotice = {
  id: string;
  sessionId: string | null;
  kind: "human" | "health" | "handoff";
  label: string;
};
