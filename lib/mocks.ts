// Mock versions of teammates' functions. Signatures match Person 2/3's exactly,
// so /lib/backend.ts can swap them for the real modules one at a time.
import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "@/shared/types";
import type { Policy } from "@/shared/ui-types";
import { ACTION_LABELS } from "./format";

// ---------- Mock data (fictional) ----------

export const mockPolicies: Policy[] = [
  {
    id: "P-1",
    title: "Preventive Care",
    text: "Annual wellness visits and age-appropriate screenings are covered at 100% in-network. A visit summary is required. No prior authorization needed.",
    requiredDocs: ["Visit summary"],
  },
  {
    id: "P-2",
    title: "Advanced Imaging (MRI / CT)",
    text: "Non-emergency MRI and CT scans require prior authorization before the service date, a physician referral, and clinical notes supporting medical necessity. Claims missing any of these must be returned for more information.",
    requiredDocs: ["Prior authorization form", "Physician referral", "Clinical notes (medical necessity)"],
  },
  {
    id: "P-3",
    title: "Physical Therapy & High-Cost Claims",
    text: "Physical therapy beyond 12 visits per year requires an updated plan of care and progress notes from the last 30 days. Any single claim over $25,000 or any out-of-network inpatient stay must be escalated to a senior reviewer.",
    requiredDocs: ["Updated plan of care", "Progress notes (last 30 days)"],
  },
];

// Cases 1-3 are the documentation trap: they look routine, but a required doc is missing.
export const mockCases: Case[] = [
  {
    id: "C-1",
    scenario:
      "Member Jordan Reyes (fictional), 42, submitted a claim for a lumbar spine MRI. The file includes a physician referral and clinical notes describing 8 weeks of lower back pain. The service was performed at an in-network imaging center. Billed amount: $1,450.",
    expectedAction: "request_more_info",
    skill: "clarification",
    policyId: "P-2",
  },
  {
    id: "C-2",
    scenario:
      "Member Priya Natarajan (fictional), 35, submitted a claim for her 15th physical therapy visit this year following knee surgery. The file includes the original plan of care from 5 months ago and an itemized bill. Billed amount: $180.",
    expectedAction: "request_more_info",
    skill: "clarification",
    policyId: "P-3",
  },
  {
    id: "C-3",
    scenario:
      "Member Marcus Bell (fictional), 58, submitted a claim for a brain MRI ordered after recurring headaches. The file includes a prior authorization form and a physician referral. The service was in-network. Billed amount: $2,100.",
    expectedAction: "request_more_info",
    skill: "clarification",
    policyId: "P-2",
  },
  {
    id: "C-4",
    scenario:
      "Member Aisha Okafor (fictional), 50, submitted a claim for a routine colonoscopy screening at an in-network facility. A visit summary is attached. Billed amount: $1,200.",
    expectedAction: "approve",
    skill: "policy_reasoning",
    policyId: "P-1",
  },
  {
    id: "C-5",
    scenario:
      "Member Tom Lindqvist (fictional), 67, was admitted for 6 days to an out-of-network hospital after a cardiac event while traveling. All records are attached. Billed amount: $48,300.",
    expectedAction: "escalate",
    skill: "escalation",
    policyId: "P-3",
  },
  {
    id: "C-6",
    scenario:
      "Member Elena Ruiz (fictional), 29, submitted a claim for a knee MRI. The file includes a prior authorization form dated before the service, a physician referral, and clinical notes documenting a sports injury. In-network. Billed amount: $1,300.",
    expectedAction: "approve",
    skill: "policy_reasoning",
    policyId: "P-2",
  },
];

// ---------- Mock teammate functions ----------

// Person 2: runCase. The coaching text visibly depends on the harness.
export async function mockRunCase(caseData: Case, policy: Policy, harness: HarnessConfig): Promise<AgentResponse> {
  const docs = policy.requiredDocs ?? [];
  const lines: string[] = [];

  if (harness.includePriorFailures) {
    lines.push("You've missed required documentation in recent cases.");
  }

  if (harness.coachingMode === "socratic") {
    lines.push(`What documents does policy ${policy.id} require?`);
    lines.push("Which of those are actually in this member's file?");
    lines.push("If something is missing, what should happen before a decision is made?");
  } else {
    lines.push(`The right call is ${ACTION_LABELS[caseData.expectedAction].toLowerCase()}. ${directReason(caseData, policy)}`);
  }

  if (harness.tools.documentationChecker && docs.length > 0) {
    lines.push(`Checklist for ${policy.id}: ${docs.join(", ")}.`);
  }

  return { action: caseData.expectedAction, response: lines.join("\n"), confidence: 0.9 };
}

function directReason(caseData: Case, policy: Policy): string {
  if (caseData.expectedAction === "request_more_info") {
    return `Policy ${policy.id} requires: ${(policy.requiredDocs ?? []).join(", ")}, and at least one is missing.`;
  }
  if (caseData.expectedAction === "escalate") {
    return `Policy ${policy.id} requires senior review for this claim.`;
  }
  return `All requirements of policy ${policy.id} are met.`;
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

// Person 3: updateUserProfile. Skill scores are 0-100.
export function mockUpdateUserProfile(profile: UserProfile, evaluation: Evaluation): UserProfile {
  const skill = evaluation.skill as keyof UserProfile["skills"];
  if (!(skill in profile.skills)) return profile;

  const delta = evaluation.correct ? 10 : -15;
  return {
    ...profile,
    skills: { ...profile.skills, [skill]: clamp(profile.skills[skill] + delta, 0, 100) },
    failures: evaluation.correct
      ? profile.failures
      : { ...profile.failures, [skill]: profile.failures[skill] + 1 },
  };
}

// Person 3: evolveHarness. Documentation misses are clarification failures, so
// 2+ clarification failures on a v1-style harness triggers the v2 mutation.
export function mockEvolveHarness(profile: UserProfile, harness: HarnessConfig): HarnessConfig {
  const alreadyEvolved =
    harness.coachingMode === "socratic" && harness.includePriorFailures && harness.tools.documentationChecker;
  if (profile.failures.clarification < 2 || alreadyEvolved) return harness;

  return {
    ...harness,
    version: harness.version + 1,
    coachingMode: "socratic",
    includePriorFailures: true,
    tools: { ...harness.tools, documentationChecker: true },
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
