import type { HarnessProbe } from "./validation.ts";
import type { Coach } from "./runtime.ts";
export const harnessProbes: HarnessProbe[] = [
  { caseData: { id: "probe-documents", scenario: "A fictional request lacks a referral.", expectedAction: "request_more_info", skill: "clarification", policyId: "fictional-v1" }, evidence: { policyText: "Require referral; escalate flagged cases.", requiredDocuments: ["referral"], providedDocuments: [], escalationRequired: false } },
  { caseData: { id: "probe-escalation", scenario: "A fictional request needs senior review.", expectedAction: "escalate", skill: "escalation", policyId: "fictional-v1" }, evidence: { policyText: "Require referral; escalate flagged cases.", requiredDocuments: ["referral"], providedDocuments: ["referral"], escalationRequired: true } },
  { caseData: { id: "probe-complete", scenario: "All fictional criteria are satisfied.", expectedAction: "approve", skill: "policy_reasoning", policyId: "fictional-v1" }, evidence: { policyText: "Require referral; escalate flagged cases.", requiredDocuments: ["referral"], providedDocuments: ["referral"], escalationRequired: false } },
];

export const probeCoach: Coach = async () => ({ action: "approve", response: "Synthetic approval probe.", confidence: 0.8 });
