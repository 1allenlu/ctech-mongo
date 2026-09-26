// The only place the app touches teammates' code. The UI and API routes call
// getState / submitDecision / getCoaching / resetDemo; this file picks mocks
// (USE_MOCKS unset or "true") or real modules (USE_MOCKS=false).
import type { Case, AgentResponse, Evaluation, UserProfile, HarnessConfig } from "@/shared/types";
import type {
  Policy,
  AppEvent,
  AppState,
  EvolutionResult,
  HarnessVersionRecord,
  ReviewerSubmission,
  SubmitResult,
} from "@/shared/ui-types";
import { getHarnessDiff } from "./diff";
import { formatFailure } from "./format";
import { withFallback, withServerSelectionTimeout } from "./resilience";
import {
  mockCases,
  mockPolicies,
  mockRunCase,
  mockEvaluate,
  mockUpdateUserProfile,
  mockEvolveHarness,
} from "./mocks";
// Person 3: evaluation + harness evolution (saves to MongoDB itself).
import { evaluate } from "@/evaluator/evaluator";
import { updateUserProfile } from "@/user-model/userModel";
import { evolveHarness, saveHarnessVersion } from "@/harness/evolver";
import { closeMongoDB, getDb } from "@/shared/mongodb";

// ---------- What the adapter needs ----------

// Where the case pointer and event log live. UI-only, not part of teammates' data.
type Progress = Pick<AppState, "currentCaseIndex" | "events">;

// Reads plus the UI-only progress. The current harness is the last history entry.
type Store = {
  loadCases(): Promise<Case[]>;
  loadPolicies(): Promise<Policy[]>;
  loadProfile(userId: string): Promise<UserProfile>;
  loadHarnessHistory(userId: string): Promise<HarnessVersionRecord[]>;
  loadProgress(userId: string): Promise<Progress>;
  saveProgress(userId: string, progress: Progress): Promise<void>;
  reset(userId: string): Promise<void>;
};

type Deps = {
  store: Store;
  runCase(caseData: Case, policy: Policy, harness: HarnessConfig): Promise<AgentResponse>;
  evaluate(caseData: Case, response: AgentResponse): Evaluation | Promise<Evaluation>;
  // Updates the profile with one evaluation and saves it.
  recordEvaluation(userId: string, evaluation: Evaluation): Promise<UserProfile>;
  evolveHarness(profile: UserProfile, harness: HarnessConfig): HarnessConfig | Promise<HarnessConfig>;
  saveHarnessVersion(userId: string, before: HarnessConfig, after: HarnessConfig, reason: string): Promise<void>;
};

const USER_ID = "demo-reviewer";

// The coach must answer within this, or a canned harness-appropriate message is used.
const COACH_TIMEOUT_MS = 10_000;

// Fail fast if Atlas is unreachable instead of hanging for the driver's 30s default.
// Set here because Person 3's shared/mongodb.ts builds the client from this variable.
if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = withServerSelectionTimeout(process.env.MONGODB_URI, 5_000);
}

const HARNESS_V1: HarnessConfig = {
  version: 1,
  coachingMode: "direct",
  includePriorFailures: false,
  tools: { policyLookup: true, documentationChecker: false },
};

function freshProfile(userId: string): UserProfile {
  return {
    userId,
    skills: { clarification: 0, policy_reasoning: 0, escalation: 0 },
    failures: { clarification: 0, policy_reasoning: 0, escalation: 0 },
  };
}

function freshProgress(now: string): Progress {
  return { currentCaseIndex: 0, events: [{ ts: now, kind: "session", text: "Session started on Harness v1" }] };
}

const initialRecord = (createdAt: string): HarnessVersionRecord => ({
  config: HARNESS_V1,
  reason: "Initial harness",
  createdAt,
});

// ---------- Mock wiring ----------

type MemoryData = { profile: UserProfile; history: HarnessVersionRecord[]; progress: Progress };

function freshMemory(userId: string): MemoryData {
  const now = new Date().toISOString();
  return { profile: freshProfile(userId), history: [initialRecord(now)], progress: freshProgress(now) };
}

// Kept on globalThis so the data survives Next.js hot reloads in dev.
// Note: on Vercel, in-memory state is per server instance and can reset.
const g = globalThis as unknown as { __mockData?: Record<string, MemoryData> };
const memory = (userId: string) => ((g.__mockData ??= {})[userId] ??= freshMemory(userId));

const mockDeps: Deps = {
  store: {
    loadCases: async () => mockCases,
    loadPolicies: async () => mockPolicies,
    loadProfile: async (userId) => memory(userId).profile,
    loadHarnessHistory: async (userId) => memory(userId).history,
    loadProgress: async (userId) => memory(userId).progress,
    saveProgress: async (userId, progress) => {
      memory(userId).progress = progress;
    },
    reset: async (userId) => {
      (g.__mockData ??= {})[userId] = freshMemory(userId);
    },
  },
  runCase: mockRunCase,
  evaluate: mockEvaluate,
  recordEvaluation: async (userId, evaluation) => {
    const m = memory(userId);
    m.profile = mockUpdateUserProfile(m.profile, evaluation);
    return m.profile;
  },
  evolveHarness: mockEvolveHarness,
  saveHarnessVersion: async (userId, _before, after, reason) => {
    const m = memory(userId);
    m.history = [...m.history, { config: after, reason, createdAt: new Date().toISOString() }];
  },
};

// ---------- Real wiring ----------

// Person 3's collections: `user_profiles` (keyed by userId) and `harness_versions`
// (one document per mutation). `sessions` is ours: case pointer + activity log.
type ProfileDoc = UserProfile & { _id: string };
type HarnessVersionDoc = { userId: string; toVersion: number; after: HarnessConfig; reason: string; timestamp: Date };
type SessionDoc = Progress & { _id: string; startedAt: string };

async function loadSession(userId: string): Promise<SessionDoc> {
  const now = new Date().toISOString();
  const session = await (await getDb()).collection<SessionDoc>("sessions").findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: { startedAt: now, ...freshProgress(now) } },
    { upsert: true, returnDocument: "after" },
  );
  return session!;
}

const mongoStore: Store = {
  // Person 1 hasn't delivered cases/policies yet; these stay mocks until then.
  loadCases: async () => mockCases,
  loadPolicies: async () => mockPolicies,
  loadProfile: async (userId) => {
    const doc = await (await getDb()).collection<ProfileDoc>("user_profiles").findOne({ _id: userId });
    return doc ? { userId, skills: doc.skills, failures: doc.failures } : freshProfile(userId);
  },
  loadHarnessHistory: async (userId) => {
    const [session, versions] = await Promise.all([
      loadSession(userId),
      (await getDb())
        .collection<HarnessVersionDoc>("harness_versions")
        .find({ userId })
        .sort({ toVersion: 1 })
        .toArray(),
    ]);
    return [
      initialRecord(session.startedAt),
      ...versions.map((v) => ({ config: v.after, reason: v.reason, createdAt: v.timestamp.toISOString() })),
    ];
  },
  loadProgress: async (userId) => {
    const { currentCaseIndex, events } = await loadSession(userId);
    return { currentCaseIndex, events };
  },
  saveProgress: async (userId, progress) => {
    await (await getDb()).collection<SessionDoc>("sessions").updateOne({ _id: userId }, { $set: progress });
  },
  reset: async (userId) => {
    const db = await getDb();
    await Promise.all([
      db.collection<ProfileDoc>("user_profiles").deleteOne({ _id: userId }),
      db.collection("harness_versions").deleteMany({ userId }),
      db.collection<SessionDoc>("sessions").deleteOne({ _id: userId }),
    ]);
  },
};

const realDeps: Deps = {
  store: mongoStore,
  runCase: mockRunCase, // Person 2: swap in the real runCase here.
  evaluate,
  recordEvaluation: (userId, evaluation) => updateUserProfile(userId, evaluation),
  evolveHarness,
  saveHarnessVersion,
};

function deps(): Deps {
  return process.env.USE_MOCKS === "false" ? realDeps : mockDeps;
}

// ---------- Evaluation + evolution (Person 3's pipeline, one call) ----------

// evaluate → update and save the profile → evolveHarness → if the harness
// changed, save the new version with its reason. Returns everything the UI shows.
export async function processEvaluationAndEvolve(
  userId: string,
  caseData: Case,
  agentResponse: AgentResponse,
  currentHarness: HarnessConfig,
): Promise<EvolutionResult> {
  const d = deps();

  const evaluation = await d.evaluate(caseData, agentResponse);
  const profile = await d.recordEvaluation(userId, evaluation);

  const harness = await d.evolveHarness(profile, currentHarness);
  const evolved = harness.version !== currentHarness.version;
  const diff = getHarnessDiff(currentHarness, harness, evolved ? mutationReason(profile, evaluation) : undefined);

  if (evolved) await d.saveHarnessVersion(userId, currentHarness, harness, diff.reason!);

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
  const coaching = await coach(d, caseData, policy, harness);

  const now = new Date().toISOString();
  const failure = evaluation.correct ? undefined : formatFailure(evaluation.failureType);
  const events: AppEvent[] = [
    ...state.events,
    { ts: now, kind: "case", text: `Case ${caseIndex + 1}: ${failure ?? "correct"}`, ...(failure && { failure }) },
  ];
  if (diff.changed) events.push({ ts: now, kind: "harness", text: `Harness updated to v${harness.version}` });

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

// Coaching for a case before the reviewer decides, with the current harness.
export async function getCoaching(caseId: string): Promise<AgentResponse> {
  const d = deps();
  const state = await getState();
  const caseData = state.cases.find((c) => c.id === caseId);
  if (!caseData) throw new Error(`Unknown case: ${caseId}`);
  const policy = state.policies.find((p) => p.id === caseData.policyId);
  if (!policy) throw new Error(`Unknown policy: ${caseData.policyId}`);
  return coach(d, caseData, policy, state.harness);
}

export async function resetDemo(): Promise<AppState> {
  await deps().store.reset(USER_ID);
  return getState();
}

// For scripts: close the MongoDB connection so the process can exit.
export async function closeBackend(): Promise<void> {
  await closeMongoDB();
}

// ---------- Helpers ----------

// runCase with a time limit. If it's slow or fails, the mock coach stands in: its
// text follows the same harness, so the demo still shows the right behavior.
function coach(d: Deps, caseData: Case, policy: Policy, harness: HarnessConfig): Promise<AgentResponse> {
  return withFallback(
    () => d.runCase(caseData, policy, harness),
    () => mockRunCase(caseData, policy, harness),
    COACH_TIMEOUT_MS,
    "runCase",
  );
}

function mutationReason(profile: UserProfile, evaluation: Evaluation): string {
  const skill = evaluation.skill as keyof UserProfile["failures"];
  const count = profile.failures[skill] ?? 0;
  return `${count} ${skill.replaceAll("_", " ")} mistakes (${formatFailure(evaluation.failureType)})`;
}
