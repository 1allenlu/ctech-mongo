import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "./types";

export type Policy = { id: string; title: string; text: string; requiredDocs?: string[] };

export type HarnessDiffItem = { field: string; from: unknown; to: unknown };

export type HarnessVersionRecord = {
  config: HarnessConfig;
  reason: string; // e.g. "2 failures: missing required documentation"
  createdAt: string;
};

export type ReviewerSubmission = { caseId: string; action: AgentResponse["action"]; rationale: string };

export type SubmitResult = {
  evaluation: Evaluation;
  coaching: AgentResponse; // copilot's coaching output from runCase
  profile: UserProfile;
  harness: HarnessConfig;
  mutated: boolean;
  diff: HarnessDiffItem[];
  reason?: string;
};

export type AppState = {
  cases: Case[];
  policies: Policy[];
  currentCaseIndex: number;
  profile: UserProfile;
  harness: HarnessConfig;
  harnessHistory: HarnessVersionRecord[];
  events: { ts: string; text: string }[];
};
