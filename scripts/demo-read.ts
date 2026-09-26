import assert from "node:assert/strict";
import { closeConnection, databaseName, getClient } from "../db/connection.js";
import { getNextCase, getPolicy, getUserProfile, getCurrentHarness, getHarnessVersions } from "../db/helpers.js";

// Server-side, read-only handoff example. Never reset a teammate's demo progress.
try {
  const userId = "demo-reviewer-001";
  const profile = await getUserProfile(userId);
  assert.ok(profile, "Demo profile is missing.");
  const next = await getNextCase(userId);
  const current = await getCurrentHarness(userId);
  const history = await getHarnessVersions(userId);
  assert.ok(current, "Initial harness is missing.");
  const db = (await getClient()).db(databaseName());
  const first = await db.collection("cases").findOne({ id: "case-001" });
  assert.ok(first, "Demo case is missing.");
  assert.equal(first.policyId, "policy-imaging-001");
  const policy = await getPolicy(first.policyId);
  assert.ok(policy, "Linked policy is missing.");
  if (next) assert.ok(await getPolicy(next.policyId), "Next case policy is missing.");
  console.log(JSON.stringify({
    mode: "read-only", database: db.databaseName, userId,
    exampleCaseId: first.id, examplePolicyId: policy.id,
    nextCaseId: next?.id ?? null,
    currentHarnessVersion: current.version,
    availableHarnessVersions: history.map(h => h.version),
    profileLoaded: true, exampleCaseAndPolicyLoaded: true,
  }, null, 2));
} catch (error) {
  console.error(`Read-only demo failed (${error instanceof Error ? error.name : "unknown error"}). Check demo seed data and server environment configuration.`);
  process.exitCode = 1;
} finally {
  await closeConnection();
}
