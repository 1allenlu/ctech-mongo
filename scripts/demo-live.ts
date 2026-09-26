import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { closeConnection, databaseName, getClient } from "../db/connection.js";
import {
  getNextCase, getPolicy, getUserProfile, saveUserProfile,
  getCurrentHarness, getHarnessVersions, saveHarnessVersion,
  saveCompletedSubmission, type CompletedSubmission,
} from "../db/helpers.js";
import type { HarnessConfig, UserProfile } from "../shared/type.js";

// An explicit fixture-based integration demo, not Person 3's scoring/evolution algorithm.
// Each applied run creates a fresh reviewer; it never resets or deletes existing data.
const userId = `demo-verification-${randomUUID()}`;
const resultPath = new URL("../docs/live-demo-result.json", import.meta.url);
let stage = "preview";
let startedWrites = false;
try {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => arg === "--apply"), "Usage: npm run demo:live -- [--apply]");
  const apply = args.includes("--apply");
  assert.equal(databaseName(), "hackathon", "This demo is scoped to hackathon.");
  console.log(JSON.stringify({
    mode: apply ? "apply" : "preview", database: databaseName(), userId,
    creates: { user_profiles: 1, harness_versions: 2, runs: 2 },
    scenario: "Two simulated wrong answers; preserve v1, save v2, advance to case-003.",
    existingReviewers: "unchanged", evaluations: "explicit test fixtures",
  }, null, 2));

  if (!apply) {
    console.log("No connection or writes. Use npm run demo:live -- --apply to run this integration demo.");
  } else {
    stage = "preflight";
    const db = (await getClient()).db(databaseName());
    assert.equal(await getUserProfile(userId), null);
    assert.deepEqual(await getHarnessVersions(userId), []);
    assert.equal(await db.collection("runs").countDocuments({ userId }), 0);
    for (const id of ["case-001", "case-002", "case-003"]) {
      const c = await db.collection("cases").findOne({ id });
      assert.ok(c, `Missing ${id}`);
      assert.equal(c.expectedAction, "request_more_info");
      assert.equal(c.skill, "clarification");
      assert.ok(await getPolicy(c.policyId), `Missing policy for ${id}`);
    }

    const initialProfile: UserProfile = {
      userId,
      skills: { clarification: 0.5, policy_reasoning: 0.5, escalation: 0.5 },
      failures: { clarification: 0, policy_reasoning: 0, escalation: 0 },
    };
    const v1: HarnessConfig = {
      version: 1, coachingMode: "direct", includePriorFailures: false,
      tools: { policyLookup: true, documentationChecker: false },
    };
    const v2: HarnessConfig = {
      version: 2, coachingMode: "socratic", includePriorFailures: true,
      tools: { policyLookup: true, documentationChecker: true },
    };

    stage = "initialize-test-reviewer";
    startedWrites = true;
    await saveUserProfile(initialProfile);
    await saveHarnessVersion(userId, v1);
    assert.deepEqual(await getUserProfile(userId), initialProfile);
    assert.deepEqual(await getCurrentHarness(userId), v1);

    let lastSubmission: CompletedSubmission | undefined;
    for (const [index, caseId] of ["case-001", "case-002"].entries()) {
      stage = `submit-${caseId}`;
      assert.equal((await getNextCase(userId))?.id, caseId);
      const previousProfile = (await getUserProfile(userId))!;
      const profile = structuredClone(previousProfile);
      profile.failures.clarification = index + 1;
      // Fixed fixture scores exercise persistence; Person 3 defines real score changes.
      profile.skills.clarification = index === 0 ? 0.4 : 0.3;
      lastSubmission = {
        userId, caseId, harnessVersion: 1, previousProfile, profile,
        harness: index === 0 ? v1 : v2,
        response: { action: "approve", response: "Simulated integration-demo mistake: approve without the required document.", confidence: 0.8 },
        evaluation: { correct: false, skill: "clarification", failureType: "missing_required_documentation" },
      };
      assert.equal(await saveCompletedSubmission(lastSubmission), "saved");
      assert.deepEqual(await getUserProfile(userId), profile);
    }

    stage = "verify-readback-and-retry";
    assert.ok(lastSubmission);
    assert.equal(await saveCompletedSubmission(lastSubmission), "already_completed");
    const profile = (await getUserProfile(userId))!;
    assert.deepEqual(profile, lastSubmission.profile);
    const history = await getHarnessVersions(userId);
    assert.deepEqual(history, [v1, v2]);
    assert.deepEqual(await getCurrentHarness(userId), v2);
    assert.equal((await getNextCase(userId))?.id, "case-003");
    const completions = await db.collection("runs").find({ userId }).sort({ caseId: 1 }).toArray();
    assert.equal(completions.length, 2);
    assert.deepEqual(completions.map(r => r.caseId), ["case-001", "case-002"]);
    assert.ok(completions.every(r => r.kind === "case_completion" && r.status === "completed" && r.harnessVersion === 1));

    const result = {
      verifiedAt: new Date().toISOString(), status: "passed", database: db.databaseName, userId,
      simulation: "Fixed test inputs; no coaching model or production evaluator was invoked.",
      documentsCreated: { user_profiles: 1, harness_versions: 2, runs: 2 },
      completedCaseIds: completions.map(r => r.caseId), nextCaseId: "case-003",
      persistedProfile: profile, harnessVersions: history,
      duplicateSubmissionResult: "already_completed",
      sharedDemoReviewer: "demo-reviewer-001 was not written to",
    };
    writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  const result = { status: "failed", stage, userId, startedWrites, errorType: error instanceof Error ? error.name : "unknown", note: "Inspect this test reviewer's records before rerunning. No automatic deletion or reset is performed." };
  if (startedWrites) writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await closeConnection();
}
