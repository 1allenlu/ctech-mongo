import type { AppState } from "../shared/ui-types";

// Simulated trainee actions, submitted through the normal API and validation gate.
export const demoSequence = [
  { caseId: "case-001", label: "Simulate documentation mistake 1", detail: "Approve a request with a missing treatment summary. The coach observes one clarification failure." },
  { caseId: "case-002", label: "Simulate documentation mistake 2", detail: "Approve a request missing a referral. This proposes Socratic coaching, memory, and document checking." },
  { caseId: "case-007", label: "Simulate escalation mistake 1", detail: "Approve an explicit exception request. The coach observes one escalation failure." },
  { caseId: "case-008", label: "Simulate escalation mistake 2", detail: "Approve a request exceeding the visit limit. This proposes an escalation guardrail." },
] as const;

export function demoProgress(state: AppState) {
  const decisions = state.events.filter(event => event.kind === "case");
  const matches = decisions.length <= demoSequence.length && decisions.every((event, index) => event.caseId === demoSequence[index].caseId && !!event.failure);
  const available = demoSequence.every(step => state.cases.some(c => c.id === step.caseId));
  return { matches, available, completed: matches ? decisions.length : 0 };
}
