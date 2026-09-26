// Display labels shared by the server (event log) and the UI.
import type { AgentResponse, Case, HarnessConfig } from "@/shared/types";

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

// Plain-language names for harness fields, shown in the UI.
export const FIELD_LABELS: Record<string, string> = {
  coachingMode: "Coaching style",
  includePriorFailures: "Mentions past mistakes",
  "tools.documentationChecker": "Document checklist",
  "tools.policyLookup": "Policy lookup",
  requireEscalationCheck: "Escalation check",
};

// The three mutable harness properties, in display order.
export const HARNESS_ROWS: { field: string; value: (h: HarnessConfig) => unknown }[] = [
  { field: "coachingMode", value: (h) => h.coachingMode },
  { field: "includePriorFailures", value: (h) => h.includePriorFailures },
  { field: "tools.documentationChecker", value: (h) => h.tools.documentationChecker },
  { field: "requireEscalationCheck", value: (h) => h.requireEscalationCheck ?? false },
];

const FAILURE_LABELS: Record<string, string> = {
  missing_documentation: "missing required documentation",
  // Person 3's evaluator reports `<skill>_incorrect_action`.
  clarification_incorrect_action: "missing required documentation",
  escalation_incorrect_action: "missed an escalation",
  policy_reasoning_incorrect_action: "misapplied the policy",
  missed_escalation: "missed an escalation",
  unnecessary_hold: "held a claim that should be approved",
};

export function formatFailure(failureType?: string): string {
  if (!failureType) return "incorrect";
  return FAILURE_LABELS[failureType] ?? failureType.replaceAll("_", " ");
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
