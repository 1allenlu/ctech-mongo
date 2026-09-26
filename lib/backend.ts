// The only place the app touches teammates' code. The UI and API routes call
// getState / submitDecision / resetDemo; this file picks mocks or real modules.
import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "@/shared/types";
import type {
  Policy,
  AppState,
  HarnessVersionRecord,
  ReviewerSubmission,
  SubmitResult,
} from "@/shared/ui-types";
import { diffHarness } from "./diff";
import {
  mockCases,
  mockPolicies,
  mockRunCase,
  mockEvaluate,
  mockUpdateUserProfile,
  mockEvolveHarness,
} from "./mocks";

// ---------- What the adapter needs from teammates ----------

type Store = {
  loadCases(): Promise<Case[]>;
  loadPolicies(): Promise<Policy[]>;
  loadSession(): Promise<Session>;
  saveSession(session: Session): Promise<void>;
};

// Mutable per-reviewer state. Everything else in AppState is static data.
type Session = Omit<AppState, "cases" | "policies">;

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

function freshSession(): Session {
  return {
    currentCaseIndex: 0,
    profile: {
      userId: USER_ID,
      skills: { clarification: 50, policy_reasoning: 50, escalation: 50 },
      failures: { clarification: 0, policy_reasoning: 0, escalation: 0 },
    },
    harness: HARNESS_V1,
    harnessHistory: [{ config: HARNESS_V1, reason: "Initial harness", createdAt: new Date().toISOString() }],
    events: [{ ts: new Date().toISOString(), text: "Session started on Harness v1" }],
  };
}

// ---------- Mock wiring ----------

// Kept on globalThis so the session survives Next.js hot reloads in dev.
// Note: on Vercel, in-memory state is per server instance and can reset.
const g = globalThis as unknown as { __mockSession?: Session };

const memoryStore: Store = {
  loadCases: async () => mockCases,
  loadPolicies: async () => mockPolicies,
  loadSession: async () => (g.__mockSession ??= freshSession()),
  saveSession: async (session) => {
    g.__mockSession = session;
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

// ---------- Public API ----------

export async function getState(): Promise<AppState> {
  const { store } = deps();
  const [cases, policies, session] = await Promise.all([store.loadCases(), store.loadPolicies(), store.loadSession()]);
  return { cases, policies, ...session };
}

export async function submitDecision(submission: ReviewerSubmission): Promise<SubmitResult> {
  const d = deps();
  const state = await getState();

  // 1. Load the case, its policy, the profile, and the harness.
  const caseIndex = state.cases.findIndex((c) => c.id === submission.caseId);
  if (caseIndex === -1) throw new Error(`Unknown case: ${submission.caseId}`);
  const caseData = state.cases[caseIndex];
  const policy = state.policies.find((p) => p.id === caseData.policyId);
  if (!policy) throw new Error(`Unknown policy: ${caseData.policyId}`);

  // 2. The reviewer's decision, shaped as an AgentResponse.
  const reviewerDecision: AgentResponse = {
    action: submission.action,
    response: submission.rationale,
    confidence: 1,
  };

  // 3-4. Score it and update the profile.
  const evaluation = await d.evaluate(caseData, reviewerDecision);
  const profile = await d.updateUserProfile(state.profile, evaluation);

  // 5. Let the harness evolve.
  const harness = await d.evolveHarness(profile, state.harness);
  const mutated = harness.version !== state.harness.version;
  const diff = mutated ? diffHarness(state.harness, harness) : [];
  const reason = mutated ? mutationReason(profile, evaluation) : undefined;

  // 6. Coaching from the copilot, using the (possibly new) harness.
  const coaching = await d.runCase(caseData, policy, harness);

  // 7. Record events and persist.
  const now = new Date().toISOString();
  const events = [
    ...state.events,
    {
      ts: now,
      text: `Case ${caseIndex + 1}: ${evaluation.correct ? "✅ correct" : `❌ ${formatFailure(evaluation.failureType)}`}`,
    },
  ];
  const harnessHistory: HarnessVersionRecord[] = mutated
    ? [...state.harnessHistory, { config: harness, reason: reason!, createdAt: now }]
    : state.harnessHistory;
  if (mutated) events.push({ ts: now, text: `Harness mutated to v${harness.version}` });

  await d.store.saveSession({
    currentCaseIndex: Math.max(state.currentCaseIndex, Math.min(caseIndex + 1, state.cases.length - 1)),
    profile,
    harness,
    harnessHistory,
    events,
  });

  return { evaluation, coaching, profile, harness, mutated, diff, reason };
}

export async function resetDemo(): Promise<AppState> {
  await deps().store.saveSession(freshSession());
  return getState();
}

// ---------- Helpers ----------

function formatFailure(failureType?: string): string {
  if (failureType === "missing_documentation") return "missing required documentation";
  return failureType ? failureType.replaceAll("_", " ") : "incorrect";
}

function mutationReason(profile: UserProfile, evaluation: Evaluation): string {
  const skill = evaluation.skill as keyof UserProfile["failures"];
  const count = profile.failures[skill] ?? 0;
  return `${count} ${skill} failures: ${formatFailure(evaluation.failureType)}`;
}
