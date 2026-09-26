import type { validateHarnessCandidate } from "../harness/validation";
export type ValidationReport = Awaited<ReturnType<typeof validateHarnessCandidate>> & { fromVersion: number; toVersion: number; benchmark: "deterministic guardrail probes" };
export type ExecutionInfo = { source: "live" | "mock" | "fallback"; storage: "Atlas" | "In-memory"; interventions: string[] };
import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "./types";

// A case as the browser sees it: the answer key stays on the server until submit.
export type PublicCase = Omit<Case, "expectedAction">;

// Coaching shown before a decision: text only, without the coach's recommended action.
export type Coaching = Pick<AgentResponse, "response"> & { execution?: ExecutionInfo };

export type Policy = { id: string; title: string; text: string; requiredDocs?: string[] };

export type HarnessDiffItem = { field: string; from: unknown; to: unknown };

export type HarnessDiff = { changed: boolean; changes: HarnessDiffItem[]; reason?: string };

// Output of processEvaluationAndEvolve: everything that changes after one decision.
export type EvolutionResult = {
  evaluation: Evaluation;
  profile: UserProfile;
  harness: HarnessConfig;
  diff: HarnessDiff;
  validation?: ValidationReport;
};

export type HarnessVersionRecord = {
  config: HarnessConfig;
  reason: string; // e.g. "2 failures: missing required documentation"
  createdAt: string;
};

export type ReviewerSubmission = { caseId: string; action: AgentResponse["action"]; rationale: string };

export type SubmitResult = {
  evaluation: Evaluation;
  validation?: ValidationReport;
  coaching: AgentResponse & { execution?: ExecutionInfo }; // copilot's coaching output from runCase
  expectedAction: AgentResponse["action"]; // revealed only after submitting
  profile: UserProfile;
  harness: HarnessConfig;
  mutated: boolean;
  diff: HarnessDiffItem[];
  reason?: string;
};

// Case events carry `caseId`; failed ones also `failure`, shown as "past mistakes".
export type AppEvent = {
  ts: string;
  kind: "session" | "case" | "harness";
  text: string;
  caseId?: string;
  failure?: string;
  expectedAction?: AgentResponse["action"]; // server-side lesson for the coach's memory
};

export type AppState = {
  cases: PublicCase[];
  policies: Policy[];
  currentCaseIndex: number;
  profile: UserProfile;
  harness: HarnessConfig;
  harnessHistory: HarnessVersionRecord[];
  events: AppEvent[];
  latestValidation?: ValidationReport;
};
