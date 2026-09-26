// The only place the app touches teammates' code. The UI and API routes call
// getState / submitDecision / resetDemo; this file picks mocks or real modules.
import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "@/shared/types";
import type {
  Policy,
  AppState,
  EvolutionResult,
  HarnessVersionRecord,
  ReviewerSubmission,
  SubmitResult,
} from "@/shared/ui-types";
import { getHarnessDiff } from "./diff";
import {
  mockCases,
  mockPolicies,
  mockRunCase,
  mockEvaluate,
  mockUpdateUserProfile,
  mockEvolveHarness,
} from "./mocks";

// ---------- What the adapter needs from teammates ----------

// Where the case pointer and event log live. UI-only, not part of teammates' data.
type Progress = Pick<AppState, "currentCaseIndex" | "events">;

// Person 1's DB helpers. The current harness is the last entry in the history.
type Store = {
  loadCases(): Promise<Case[]>;
  loadPolicies(): Promise<Policy[]>;
  loadProfile(userId: string): Promise<UserProfile>;
  saveProfile(profile: UserProfile): Promise<void>;
  loadHarnessHistory(userId: string): Promise<HarnessVersionRecord[]>;
  saveHarnessVersion(userId: string, record: HarnessVersionRecord): Promise<void>;
  loadProgress(userId: string): Promise<Progress>;
  saveProgress(userId: string, progress: Progress): Promise<void>;
  reset(userId: string): Promise<void>;
};

type Deps = {
  store: Store;
  runCase(caseData: Case, policy: Policy, harness: HarnessConfig): Promise<AgentResponse>;
  evaluate(caseData: Case, response: AgentResponse): Evaluation | Promise<Evaluation>;
  updateUserProfile(profile: UserProfile, evaluation: Evaluation): UserProfile | Promise<UserProfile>;
  evolveHarness(profile: UserProfile, harness: HarnessConfig): HarnessConfig | Promise<HarnessConfig>;
};

const USER_ID = "demo-reviewer";

const HARNESS_V1: HarnessConfig = {
  version: 1,
  coachingMode: "direct",
  includePriorFailures: false,
  tools: { policyLookup: true, documentationChecker: false },
};

function freshProfile(userId: string): UserProfile {
  return {
    userId,
    skills: { clarification: 50, policy_reasoning: 50, escalation: 50 },
    failures: { clarification: 0, policy_reasoning: 0, escalation: 0 },
  };
}

// ---------- Mock wiring ----------

type MemoryData = { profile: UserProfile; history: HarnessVersionRecord[]; progress: Progress };

function freshMemory(userId: string): MemoryData {
  const now = new Date().toISOString();
  return {
    profile: freshProfile(userId),
    history: [{ config: HARNESS_V1, reason: "Initial harness", createdAt: now }],
    progress: { currentCaseIndex: 0, events: [{ ts: now, text: "Session started on Harness v1" }] },
  };
}

// Kept on globalThis so the data survives Next.js hot reloads in dev.
// Note: on Vercel, in-memory state is per server instance and can reset.
const g = globalThis as unknown as { __mockData?: Record<string, MemoryData> };
const memory = (userId: string) => ((g.__mockData ??= {})[userId] ??= freshMemory(userId));

const memoryStore: Store = {
  loadCases: async () => mockCases,
  loadPolicies: async () => mockPolicies,
  loadProfile: async (userId) => memory(userId).profile,
  saveProfile: async (profile) => {
    memory(profile.userId).profile = profile;
  },
  loadHarnessHistory: async (userId) => memory(userId).history,
  saveHarnessVersion: async (userId, record) => {
    const m = memory(userId);
    m.history = [...m.history, record];
  },
  loadProgress: async (userId) => memory(userId).progress,
  saveProgress: async (userId, progress) => {
    memory(userId).progress = progress;
  },
  reset: async (userId) => {
    (g.__mockData ??= {})[userId] = freshMemory(userId);
  },
};

const mockDeps: Deps = {
  store: memoryStore,
  runCase: mockRunCase,
  evaluate: mockEvaluate,
  updateUserProfile: mockUpdateUserProfile,
  evolveHarness: mockEvolveHarness,
};

// ---------- Real wiring (Phase 4) ----------

// Swap in one piece at a time: DB helpers, then evaluate/updateUserProfile,
// then evolveHarness, then runCase. Anything not yet real can stay a mock.
function realDeps(): Deps {
  throw new Error("Real backend not wired yet. Set USE_MOCKS=true, or add teammates' modules in lib/backend.ts.");
}

function deps(): Deps {
  return process.env.USE_MOCKS === "false" ? realDeps() : mockDeps;
}

// ---------- Evaluation + evolution (Person 3's pipeline, one call) ----------

// evaluate → updateUserProfile → evolveHarness → save profile and, if the
// harness changed, the new version with its reason. Returns everything the UI shows.
export async function processEvaluationAndEvolve(
  userId: string,
  caseData: Case,
  agentResponse: AgentResponse,
  currentHarness: HarnessConfig,
): Promise<EvolutionResult> {
  const d = deps();

  const evaluation = await d.evaluate(caseData, agentResponse);
  const profile = await d.updateUserProfile(await d.store.loadProfile(userId), evaluation);
  await d.store.saveProfile(profile);

  const harness = await d.evolveHarness(profile, currentHarness);
  const evolved = harness.version !== currentHarness.version;
  const diff = getHarnessDiff(currentHarness, harness, evolved ? mutationReason(profile, evaluation) : undefined);

  if (evolved) {
    await d.store.saveHarnessVersion(userId, {
      config: harness,
      reason: diff.reason!,
      createdAt: new Date().toISOString(),
    });
  }

  return { evaluation, profile, harness, diff };
}

// ---------- Public API ----------

export async function getState(): Promise<AppState> {
  const { store } = deps();
  const [cases, policies, profile, history, progress] = await Promise.all([
    store.loadCases(),
    store.loadPolicies(),
    store.loadProfile(USER_ID),
    store.loadHarnessHistory(USER_ID),
    store.loadProgress(USER_ID),
  ]);
  return { cases, policies, profile, harness: history[history.length - 1].config, harnessHistory: history, ...progress };
}

export async function submitDecision(submission: ReviewerSubmission): Promise<SubmitResult> {
  const d = deps();
  const state = await getState();

  const caseIndex = state.cases.findIndex((c) => c.id === submission.caseId);
  if (caseIndex === -1) throw new Error(`Unknown case: ${submission.caseId}`);
  const caseData = state.cases[caseIndex];
  const policy = state.policies.find((p) => p.id === caseData.policyId);
  if (!policy) throw new Error(`Unknown policy: ${caseData.policyId}`);

  // The reviewer's decision, shaped as an AgentResponse.
  const reviewerDecision: AgentResponse = {
    action: submission.action,
    response: submission.rationale,
    confidence: 1,
  };

  const { evaluation, profile, harness, diff } = await processEvaluationAndEvolve(
    USER_ID,
    caseData,
    reviewerDecision,
    state.harness,
  );

  // Coaching from the copilot, using the (possibly new) harness.
  const coaching = await d.runCase(caseData, policy, harness);

  const now = new Date().toISOString();
  const events = [
    ...state.events,
    {
      ts: now,
      text: `Case ${caseIndex + 1}: ${evaluation.correct ? "✅ correct" : `❌ ${formatFailure(evaluation.failureType)}`}`,
    },
  ];
  if (diff.changed) events.push({ ts: now, text: `Harness mutated to v${harness.version}` });

  await d.store.saveProgress(USER_ID, {
    currentCaseIndex: Math.max(state.currentCaseIndex, Math.min(caseIndex + 1, state.cases.length - 1)),
    events,
  });

  return {
    evaluation,
    coaching,
    profile,
    harness,
    mutated: diff.changed,
    diff: diff.changes,
    reason: diff.reason,
  };
}

export async function resetDemo(): Promise<AppState> {
  await deps().store.reset(USER_ID);
  return getState();
}

// ---------- Helpers ----------

const FAILURE_LABEL: Record<string, string> = {
  missing_documentation: "missing required documentation",
  missed_escalation: "missed an escalation",
  unnecessary_hold: "held a claim that should be approved",
};

function formatFailure(failureType?: string): string {
  if (!failureType) return "incorrect";
  return FAILURE_LABEL[failureType] ?? failureType.replaceAll("_", " ");
}

function mutationReason(profile: UserProfile, evaluation: Evaluation): string {
  const skill = evaluation.skill as keyof UserProfile["failures"];
  const count = profile.failures[skill] ?? 0;
  return `${count} ${skill} failures: ${formatFailure(evaluation.failureType)}`;
}
