import type { OfficeRole } from "./types";
export const OFFICE_ROLES: readonly OfficeRole[] = [
  "coordinator",
  "researcher",
  "coder",
  "reviewer",
  "functional-reviewer",
  "hr",
  "scrum-master",
  "product-owner",
];
export const officeRole = (agent?: string): OfficeRole =>
  OFFICE_ROLES.includes(agent as OfficeRole)
    ? (agent as OfficeRole)
    : "unknown";
export const ROLE_NAMES: Record<OfficeRole, string> = {
  coordinator: "Executive assistant",
  researcher: "Research",
  coder: "Engineering",
  reviewer: "Code review",
  "functional-reviewer": "Functional review",
  hr: "Capabilities",
  "scrum-master": "Team health",
  "product-owner": "Product Owner",
  unknown: "Unverified role",
};
export const ROLE_DUTIES: Record<OfficeRole, string> = {
  coordinator:
    "Plans, delegates and integrates results with the human manager.",
  researcher:
    "Investigates the codebase and external sources; reports evidence.",
  coder: "Implements changes and verifies behavior.",
  reviewer: "Reviews code and design for meaningful issues.",
  "functional-reviewer":
    "Exercises application workflows and gathers evidence.",
  hr: "Builds agent, skill, plugin and tool capabilities.",
  "scrum-master": "Inspects team health, stalls and coordination protocols.",
  "product-owner":
    "Keeps the product aligned to its approved goal, prioritizes evidence-backed outcomes and proposes experiments.",
  unknown:
    "The source has no recognized registered role. Ownership is shown only when an observed delegation establishes it.",
};
