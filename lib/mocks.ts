import { evolveHarness } from "../harness/evolver";
// Mock versions of teammates' functions. Signatures match Person 2/3's exactly,
// so /lib/backend.ts can swap them for the real modules one at a time.
import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "@/shared/types";
import type { Policy } from "@/shared/ui-types";
import { ACTION_LABELS } from "./format";
import seedCases from "@/seed/draft/cases.json";
import seedPolicies from "@/seed/draft/policies.json";

// ---------- Mock data ----------

// Person 1's seed files: the same cases and policies that are in Atlas.
export const mockCases = seedCases as Case[];
export const mockPolicies: Policy[] = seedPolicies.map(toPolicy);

// Person 1 stores `requiredDocumentation`; the UI uses `requiredDocs`.
export function toPolicy(doc: { id: string; title: string; text: string; requiredDocumentation?: string[] }): Policy {
  return { id: doc.id, title: doc.title, text: doc.text, requiredDocs: doc.requiredDocumentation };
}

// ---------- Mock teammate functions ----------

// Person 2: runCase. The coaching text visibly depends on the harness.
export async function mockRunCase(caseData: Case, policy: Policy, harness: HarnessConfig): Promise<AgentResponse> {
  const docs = policy.requiredDocs ?? [];
  const lines: string[] = [];

  if (harness.includePriorFailures) {
    lines.push("You've missed required documentation in recent cases.");
  }

  if (harness.coachingMode === "socratic") {
    lines.push("What documents does this policy require?");
    lines.push("Which of those are actually in this member's file?");
    lines.push("If something is missing, what should happen before a decision is made?");
  } else {
    lines.push(`The right call is ${ACTION_LABELS[caseData.expectedAction].toLowerCase()}. ${directReason(caseData, policy)}`);
  }

  if (harness.tools.documentationChecker && docs.length > 0) {
    lines.push(`Checklist: ${docs.join(", ")}.`);
  }

  return { action: caseData.expectedAction, response: lines.join("\n"), confidence: 0.9 };
}

function directReason(caseData: Case, policy: Policy): string {
  if (caseData.expectedAction === "request_more_info") {
    return `The policy requires: ${(policy.requiredDocs ?? []).join(", ")}, and at least one is missing.`;
  }
  if (caseData.expectedAction === "escalate") {
    return "The policy requires senior review for this claim.";
  }
  return "All of the policy's requirements are met.";
}

// Person 3: evaluate. Scores the reviewer's decision against the expected action.
export function mockEvaluate(caseData: Case, response: AgentResponse): Evaluation {
  if (response.action === caseData.expectedAction) {
    return { correct: true, skill: caseData.skill };
  }
  const failureType =
    caseData.expectedAction === "request_more_info"
      ? "missing_documentation"
      : caseData.expectedAction === "escalate"
        ? "missed_escalation"
        : "unnecessary_hold";
  return { correct: false, skill: caseData.skill, failureType };
}

// Person 3: updateUserProfile. Same meaning as the real one: `skills` counts
// correct answers and `failures` counts incorrect ones.
export function mockUpdateUserProfile(profile: UserProfile, evaluation: Evaluation): UserProfile {
  const skill = evaluation.skill as keyof UserProfile["skills"];
  if (!(skill in profile.skills)) return profile;
  const counter = evaluation.correct ? "skills" : "failures";
  return { ...profile, [counter]: { ...profile[counter], [skill]: profile[counter][skill] + 1 } };
}

// Person 3: evolveHarness. Documentation misses are clarification failures, so
// 2+ clarification failures on a v1-style harness triggers the v2 mutation.
export function mockEvolveHarness(profile: UserProfile, harness: HarnessConfig): HarnessConfig {
  return evolveHarness(profile, harness);
}
