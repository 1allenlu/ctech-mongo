import type { AgentResponse, Case, HarnessConfig } from "../shared/type.ts";

// Supplied by the policy/case layer, never inferred from the evaluator's answer key.
export type ReviewEvidence = {
  policyText: string;
  requiredDocuments: string[];
  providedDocuments?: string[];
  escalationRequired: boolean;
  priorFailures?: string[];
};
export type CoachingInput = {
  case: Pick<Case, "id" | "scenario" | "policyId">;
  instructions: string;
  policy: string | null;
  priorFailures: string[];
  documentationCheck: { missing: string[] | null } | null;
  escalationCheck: { required: boolean } | null;
};
export type Coach = (input: CoachingInput) => Promise<AgentResponse>;

export function buildHarnessInput(caseData: Case, evidence: ReviewEvidence, harness: HarnessConfig): CoachingInput {
  return {
    case: { id: caseData.id, scenario: caseData.scenario, policyId: caseData.policyId },
    instructions: harness.coachingMode === "socratic"
      ? "Ask guiding questions about the evidence before the reviewer decides. Do not reveal the answer."
      : "Give concise direct guidance grounded in the supplied policy and evidence.",
    policy: harness.tools.policyLookup ? evidence.policyText : null,
    priorFailures: harness.includePriorFailures ? (evidence.priorFailures ?? []).slice(-3) : [],
    documentationCheck: harness.tools.documentationChecker ? {
      missing: evidence.providedDocuments === undefined ? null
        : evidence.requiredDocuments.filter(document => !evidence.providedDocuments!.includes(document)),
    } : null,
    escalationCheck: harness.requireEscalationCheck ? { required: evidence.escalationRequired } : null,
  };
}

export async function runWithHarness(caseData: Case, evidence: ReviewEvidence, harness: HarnessConfig, coach: Coach) {
  const input = buildHarnessInput(caseData, evidence, harness);
  const raw = await coach(input);
  if (!["approve", "request_more_info", "escalate"].includes(raw.action)
    || typeof raw.response !== "string" || !raw.response.trim()
    || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    throw new Error("Invalid coach response");
  }
  const response = { ...raw };
  const interventions: string[] = [];
  // Enforce enabled guardrails outside the model. Escalation takes precedence.
  if (input.escalationCheck?.required && response.action !== "escalate") {
    response.action = "escalate";
    response.response = harness.coachingMode === "socratic"
      ? "Which escalation criterion applies, and who should review this case?"
      : "Route this case to a senior reviewer because an escalation criterion applies.";
    response.confidence = 0; // Original model confidence does not describe an overridden recommendation.
    interventions.push("escalation_required");
  } else if (input.documentationCheck && response.action === "approve"
    && (input.documentationCheck.missing === null || input.documentationCheck.missing.length > 0)) {
    response.action = "request_more_info";
    response.response = harness.coachingMode === "socratic"
      ? "What required evidence is missing or unverified before you can decide?"
      : "Request the missing or unverified documentation before approving.";
    response.confidence = 0;
    interventions.push("documentation_incomplete_or_unknown");
  }
  return { input, raw, response, interventions };
}
