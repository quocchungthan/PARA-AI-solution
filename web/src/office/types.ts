import type { Session, Delegation } from "../store";
import type { OfficeStyleId } from './styles/types';
export type OfficeRole =
  | "coordinator"
  | "researcher"
  | "coder"
  | "reviewer"
  | "functional-reviewer"
  | "hr"
  | "scrum-master"
  | "unknown";
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
  counts: { working: number; unfinished: number; needsHuman: number; healthIssues: number; failedHandoffs: number };
  delegations: readonly Delegation[];
  diagnostics: readonly { sessionId?: string; delegationKey?: string; message: string }[];
  pendingAssignments: readonly { delegationKey: string; targetId: string }[];
};
export type SharedOfficeSelection =
  | null
  | { kind: "human" }
  | { kind: "department"; agent: string }
  | { kind: "session"; sessionId: string };
export type SharedOfficeEvent = {
  id: string; kind: "arrive" | "handoff" | "report" | "leave"; sessionId: string;
  originId?: string; delegationKey?: string; createdAt: number; startedAt?: number;
};
export type SharedOfficeRuntime = {
  styleId: OfficeStyleId;
  camerasByStyle: Partial<Record<OfficeStyleId,CameraPose>>;
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
