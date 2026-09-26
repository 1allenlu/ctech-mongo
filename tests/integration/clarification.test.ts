import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { Db } from "mongodb";
import { evaluate } from "../../evaluator/evaluator.ts";
import { evolveHarness, saveHarnessVersion } from "../../harness/evolver.ts";
import { closeMongoDB, getDb } from "../../shared/mongodb.ts";
import type { Case, HarnessConfig, UserProfile } from "../../shared/type.ts";
import { updateUserProfile } from "../../user-model/userModel.ts";

test("two failed clarification cases evolve and persist the harness in MongoDB", async (t) => {
  const userId = `integration-clarification-${randomUUID()}`;
  let db: Db | undefined;
  // Delete only this run's records, even if an assertion fails, then close.
  t.after(async () => {
    try {
      if (db) await Promise.all([
        db.collection("user_profiles").deleteMany({ userId }),
        db.collection("harness_versions").deleteMany({ userId }),
      ]);
    } finally {
      await closeMongoDB();
    }
  });
  db = await getDb();

  const initial: HarnessConfig = {
    version: 1,
    coachingMode: "direct",
    includePriorFailures: false,
    tools: { policyLookup: true, documentationChecker: false },
  };
  let harness = initial;
  const cases: Case[] = [
    { id: "missing-referral", scenario: "A fictional request is missing a required referral.", expectedAction: "request_more_info", skill: "clarification", policyId: "fictional-policy" },
    { id: "missing-documentation", scenario: "A fictional request is missing required supporting documentation.", expectedAction: "request_more_info", skill: "clarification", policyId: "fictional-policy" },
  ];
  const reason = "Two clarification failures";

  for (const [index, caseData] of cases.entries()) {
    const evaluation = evaluate(caseData, { action: "approve", response: "Approve the request.", confidence: 0.9 });
    assert.equal(evaluation.correct, false);
    const profile = await updateUserProfile(userId, evaluation);
    assert.equal(profile.failures.clarification, index + 1);
    const next = evolveHarness(profile, harness);
    if (next.version !== harness.version) await saveHarnessVersion(userId, harness, next, reason);
    harness = next;
    if (index === 0) assert.deepEqual(harness, initial);
  }

  const persistedProfile = await db.collection<UserProfile>("user_profiles").findOne({ userId });
  assert.ok(persistedProfile);
  assert.equal(persistedProfile.failures.clarification, 2);
  assert.equal(harness.version, initial.version + 1);
  assert.equal(harness.coachingMode, "socratic");
  assert.equal(harness.includePriorFailures, true);
  assert.equal(harness.tools.documentationChecker, true);

  const versions = await db.collection("harness_versions").find({ userId }).toArray();
  assert.equal(versions.length, 1);
  assert.equal(versions[0].userId, userId);
  assert.equal(versions[0].fromVersion, 1);
  assert.equal(versions[0].toVersion, 2);
  assert.deepEqual(versions[0].before, initial);
  assert.deepEqual(versions[0].after, harness);
  assert.deepEqual(versions[0].changes, {
    version: { before: 1, after: 2 },
    coachingMode: { before: "direct", after: "socratic" },
    includePriorFailures: { before: false, after: true },
    "tools.documentationChecker": { before: false, after: true },
  });
  assert.equal(versions[0].reason, reason);
  assert.ok(versions[0].timestamp instanceof Date);
});
