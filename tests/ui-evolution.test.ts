import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { processEvaluationAndEvolve, getCoaching } from "../lib/backend";
import { withCaseEvidence } from "../lib/case-evidence";
import { mockCases } from "../lib/mocks";
import type { HarnessConfig } from "../shared/types";

const initial: HarnessConfig = { version: 1, coachingMode: "direct", includePriorFailures: false, tools: { policyLookup: true, documentationChecker: false } };
test("UI pipeline validates before promotion and keeps its version on probe rejection", async () => {
  process.env.USE_MOCKS = "true";
  const id = randomUUID();
  const wrong = { action: "approve" as const, response: "Approve", confidence: 1 };
  const first = await processEvaluationAndEvolve(id, mockCases[0], wrong, initial);
  assert.equal(first.validation, undefined);
  const second = await processEvaluationAndEvolve(id, mockCases[1], wrong, first.harness);
  assert.equal(second.validation?.accepted, true);
  assert.equal(second.harness.version, 2);
  assert.equal(second.validation?.afterCorrect, 2);
  // Correct the version only, leave all learned behaviors already active. The
  // candidate now adds memory/style but cannot improve recommendation accuracy.
  const alreadyProtected = { ...initial, tools: { ...initial.tools, documentationChecker: true }, requireEscalationCheck: true };
  const rejected = await processEvaluationAndEvolve(id, mockCases[0], wrong, alreadyProtected);
  assert.equal(rejected.validation?.accepted, false);
  assert.deepEqual(rejected.harness, alreadyProtected);
  assert.equal(rejected.diff.changed, false);
});

test("authored evidence matches document and conflict narratives, not edited cases", () => {
  assert.deepEqual(withCaseEvidence(mockCases[1]).providedDocuments, ["Treatment plan stating the requested visit count"]);
  assert.equal(withCaseEvidence(mockCases[8]).escalationRequired, true);
  assert.match(withCaseEvidence(mockCases[8]).escalationReason!, /conflicting service dates/);
  assert.equal(withCaseEvidence({ ...mockCases[8], scenario: "Changed case" }).escalationRequired, undefined);
});

test("pre-decision coaching exposes execution source but no action", async () => {
  process.env.USE_MOCKS = "true";
  const result = await getCoaching("case-001");
  assert.equal(result.execution?.source, "mock");
  assert.equal(result.execution?.storage, "In-memory");
  assert.equal("action" in result, false);
});

test("guided demo reaches v2 then v3 through normal candidate validation", async () => {
  process.env.USE_MOCKS = "true";
  const userId = randomUUID();
  let harness = initial;
  for (const [index, caseIndex] of [0, 1, 6, 7].entries()) {
    const result = await processEvaluationAndEvolve(userId, mockCases[caseIndex], { action: "approve", response: "Simulated demo decision", confidence: 1 }, harness);
    harness = result.harness;
    assert.equal(harness.version, [1, 2, 2, 3][index]);
    if (index === 1 || index === 3) assert.equal(result.validation?.accepted, true);
  }
  assert.equal(harness.coachingMode, "socratic");
  assert.equal(harness.includePriorFailures, true);
  assert.equal(harness.tools.documentationChecker, true);
  assert.equal(harness.requireEscalationCheck, true);
});
