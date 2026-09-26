// Display labels shared by the server (event log) and the UI.
import type { AgentResponse, Case } from "@/shared/types";

export const ACTION_LABELS: Record<AgentResponse["action"], string> = {
  approve: "Approve",
  request_more_info: "Request more info",
  escalate: "Escalate",
};

export const SKILL_LABELS: Record<Case["skill"], string> = {
  clarification: "Clarification",
  policy_reasoning: "Policy reasoning",
  escalation: "Escalation",
};

export const FIELD_LABELS: Record<string, string> = {
  coachingMode: "Coaching mode",
  includePriorFailures: "Prior failures in coaching",
  "tools.documentationChecker": "Documentation checker",
  "tools.policyLookup": "Policy lookup",
  requireEscalationCheck: "Escalation check",
};

const FAILURE_LABELS: Record<string, string> = {
  missing_documentation: "missing required documentation",
  missed_escalation: "missed an escalation",
  unnecessary_hold: "held a claim that should be approved",
};

export function formatFailure(failureType?: string): string {
  if (!failureType) return "incorrect";
  return FAILURE_LABELS[failureType] ?? failureType.replaceAll("_", " ");
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}
