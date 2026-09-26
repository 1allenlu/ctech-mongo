import { isDeepStrictEqual } from "node:util";
import type { ClientSession, Db, Document, MongoClient, ObjectId } from "mongodb";
import type { AgentResponse, Case, Evaluation, HarnessConfig, UserProfile } from "../shared/type.js";
import { databaseName, getClient } from "./connection.js";

export type Policy = {
  id: string;
  title: string;
  text: string;
  requiredDocumentation: string[];
};

export type CompletedSubmission = {
  userId: string;
  caseId: string;
  harnessVersion: number;
  response: AgentResponse;
  evaluation: Evaluation;
  previousProfile: UserProfile;
  profile: UserProfile;
  harness: HarnessConfig;
};

function withoutId<T>(doc: Document | null): T | null {
  if (!doc) return null;
  const { _id, ...value } = doc;
  return value as T;
}

function identifier(value: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error("A nonempty ID is required.");
}

export function validateProfile(profile: UserProfile): void {
  identifier(profile.userId);
  for (const skill of ["clarification", "policy_reasoning", "escalation"] as const) {
    const score = profile.skills[skill];
    const failures = profile.failures[skill];
    if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Skill scores must be between 0 and 1.");
    if (!Number.isSafeInteger(failures) || failures < 0) throw new Error("Failure counts must be nonnegative integers.");
  }
}

export function validateHarness(harness: HarnessConfig): void {
  if (!Number.isSafeInteger(harness.version) || harness.version < 1) throw new Error("Harness version must be a positive integer.");
  if (!["direct", "socratic"].includes(harness.coachingMode)
    || typeof harness.includePriorFailures !== "boolean"
    || typeof harness.tools.policyLookup !== "boolean"
    || typeof harness.tools.documentationChecker !== "boolean") throw new Error("Invalid harness configuration.");
}

// Exported factory enables isolated testing without connecting to Atlas.
export function createHelpers(db: Db, client: Pick<MongoClient, "withSession">) {
  const cases = db.collection("cases");
  const policies = db.collection("policies");
  const profiles = db.collection<Document & { _id: ObjectId | string }>("user_profiles");
  const harnesses = db.collection<Document & { _id: ObjectId | string }>("harness_versions");
  const runs = db.collection<Document & { _id: ObjectId | string }>("runs");

  async function getUserProfile(userId: string): Promise<UserProfile | null> {
    identifier(userId);
    return withoutId<UserProfile>(await profiles.findOne({ userId }));
  }

  async function getNextCase(userId: string): Promise<Case | null> {
    if (!await getUserProfile(userId)) throw new Error("Unknown reviewer; initialize their profile first.");
    const completed = await runs.distinct("caseId", { userId, kind: "case_completion", status: "completed" });
    return withoutId<Case>(await cases.findOne({ id: { $nin: completed } }, { sort: { id: 1 } }));
  }

  async function getPolicy(policyId: string): Promise<Policy | null> {
    identifier(policyId);
    return withoutId<Policy>(await policies.findOne({ id: policyId }));
  }

  async function getCurrentHarness(userId: string): Promise<HarnessConfig | null> {
    identifier(userId);
    const doc = await harnesses.findOne({ userId }, { sort: { version: -1 } });
    if (!doc) return null;
    const { _id, userId: storedUserId, ...config } = doc;
    return config as HarnessConfig;
  }

  async function saveUserProfile(profile: UserProfile): Promise<void> {
    validateProfile(profile);
    const existing = await profiles.findOne({ userId: profile.userId });
    // Preserve the ObjectId of a seeded profile; deterministic IDs protect new profiles from duplicate creation.
    const _id = existing?._id ?? `profile:${JSON.stringify(profile.userId)}`;
    await profiles.replaceOne({ _id }, { ...profile, _id }, { upsert: true });
  }

  async function getHarnessVersions(userId: string): Promise<HarnessConfig[]> {
    identifier(userId);
    const docs = await harnesses.find({ userId }).sort({ version: 1 }).toArray();
    return docs.map(({ _id, userId: storedUserId, ...config }) => config as HarnessConfig);
  }

  async function persistHarness(userId: string, harness: HarnessConfig, session?: ClientSession): Promise<void> {
    identifier(userId);
    validateHarness(harness);
    const existing = await harnesses.findOne({ userId, version: harness.version }, { session });
    if (existing) {
      if (!isDeepStrictEqual(withoutId(existing), { ...harness, userId })) throw new Error("Harness version already exists with different content.");
      return;
    }
    const _id = `harness:${JSON.stringify([userId, harness.version])}`;
    await harnesses.insertOne({ ...harness, userId, _id }, { session });
  }

  async function saveHarnessVersion(userId: string, harness: HarnessConfig): Promise<void> {
    await persistHarness(userId, harness);
  }

  async function saveCompletedSubmission(input: CompletedSubmission): Promise<"saved" | "already_completed"> {
    identifier(input.userId);
    identifier(input.caseId);
    validateProfile(input.profile);
    validateProfile(input.previousProfile);
    validateHarness(input.harness);
    if (input.profile.userId !== input.userId || input.previousProfile.userId !== input.userId) throw new Error("Profile belongs to a different reviewer.");
    if (!["approve", "request_more_info", "escalate"].includes(input.response.action)
      || typeof input.response.response !== "string" || !Number.isFinite(input.response.confidence)
      || input.response.confidence < 0 || input.response.confidence > 1
      || typeof input.evaluation.correct !== "boolean") throw new Error("Invalid submission result.");
    const completionId = `completion:${JSON.stringify([input.userId, input.caseId])}`;

    return client.withSession(session => session.withTransaction(async () => {
      const completed = await runs.findOne({ kind: "case_completion", userId: input.userId, caseId: input.caseId, status: "completed" }, { session });
      if (completed) return "already_completed" as const;

      const stored = await profiles.findOne({ userId: input.userId }, { session });
      if (!stored || !isDeepStrictEqual(withoutId(stored), input.previousProfile)) throw new Error("Profile changed; reload it and recalculate this submission.");
      const priorRuns = await runs.distinct("caseId", { userId: input.userId, kind: "case_completion", status: "completed" }, { session });
      const next = await cases.findOne({ id: { $nin: priorRuns } }, { sort: { id: 1 }, session });
      if (!next || next.id !== input.caseId) throw new Error("Only the next uncompleted case can be submitted.");
      if (input.evaluation.skill !== next.skill) throw new Error("Evaluation skill does not match the case.");
      const current = await harnesses.findOne({ userId: input.userId }, { sort: { version: -1 }, session });
      if (!current || current.version !== input.harnessVersion) throw new Error("Harness changed; reload before submitting.");
      if (input.harness.version !== current.version && input.harness.version !== current.version + 1) throw new Error("Save the current harness or its next version.");

      // Transaction operations are sequential. A failure rolls back all three writes.
      await profiles.replaceOne({ _id: stored._id }, { ...input.profile, _id: stored._id }, { session });
      await persistHarness(input.userId, input.harness, session);
      await runs.insertOne({
        _id: completionId, kind: "case_completion", status: "completed",
        userId: input.userId, caseId: input.caseId, harnessVersion: input.harnessVersion,
        response: input.response, evaluation: input.evaluation, completedAt: new Date(),
      }, { session });
      return "saved" as const;
    }));
  }

  return { getNextCase, getPolicy, getUserProfile, saveUserProfile, getCurrentHarness, getHarnessVersions, saveHarnessVersion, saveCompletedSubmission };
}

async function helpers() {
  const client = await getClient();
  return createHelpers(client.db(databaseName()), client);
}

export async function getNextCase(userId: string) { return (await helpers()).getNextCase(userId); }
export async function getPolicy(policyId: string) { return (await helpers()).getPolicy(policyId); }
export async function getUserProfile(userId: string) { return (await helpers()).getUserProfile(userId); }
export async function saveUserProfile(profile: UserProfile) { return (await helpers()).saveUserProfile(profile); }
export async function getCurrentHarness(userId: string) { return (await helpers()).getCurrentHarness(userId); }
export async function getHarnessVersions(userId: string) { return (await helpers()).getHarnessVersions(userId); }
export async function saveHarnessVersion(userId: string, harness: HarnessConfig) { return (await helpers()).saveHarnessVersion(userId, harness); }
export async function saveCompletedSubmission(input: CompletedSubmission) { return (await helpers()).saveCompletedSubmission(input); }
