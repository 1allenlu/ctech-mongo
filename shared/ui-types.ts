import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "./types";

// A case as the browser sees it: the answer key stays on the server until submit.
export type PublicCase = Omit<Case, "expectedAction">;

// Coaching shown before a decision: text only, without the coach's recommended action.
export type Coaching = Pick<AgentResponse, "response">;

export type Policy = { id: string; title: string; text: string; requiredDocs?: string[] };

export type HarnessDiffItem = { field: string; from: unknown; to: unknown };

export type HarnessDiff = { changed: boolean; changes: HarnessDiffItem[]; reason?: string };

// Output of processEvaluationAndEvolve: everything that changes after one decision.
export type EvolutionResult = {
  evaluation: Evaluation;
  profile: UserProfile;
  harness: HarnessConfig;
  diff: HarnessDiff;
};

export type HarnessVersionRecord = {
  config: HarnessConfig;
  reason: string; // e.g. "2 failures: missing required documentation"
  createdAt: string;
};

export type ReviewerSubmission = { caseId: string; action: AgentResponse["action"]; rationale: string };

export type SubmitResult = {
  evaluation: Evaluation;
  coaching: AgentResponse; // copilot's coaching output from runCase
  expectedAction: AgentResponse["action"]; // revealed only after submitting
  profile: UserProfile;
  harness: HarnessConfig;
  mutated: boolean;
  diff: HarnessDiffItem[];
  reason?: string;
};

// `failure` is set on failed case events; the UI shows these as "past mistakes".
export type AppEvent = { ts: string; kind: "session" | "case" | "harness"; text: string; failure?: string };

export type AppState = {
  cases: PublicCase[];
  policies: Policy[];
  currentCaseIndex: number;
  profile: UserProfile;
  harness: HarnessConfig;
  harnessHistory: HarnessVersionRecord[];
  events: AppEvent[];
};
