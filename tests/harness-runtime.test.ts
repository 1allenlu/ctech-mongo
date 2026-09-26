import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHarnessInput, runWithHarness, type Coach, type ReviewEvidence } from "../harness/runtime.ts";
import { validateHarnessCandidate } from "../harness/validation.ts";
import { evolveHarness } from "../harness/evolver.ts";
import type { Case, HarnessConfig, UserProfile } from "../shared/type.ts";

const initial: HarnessConfig = { version: 1, coachingMode: "direct", includePriorFailures: false, tools: { policyLookup: true, documentationChecker: false } };
const caseData: Case = { id: "probe", scenario: "Fictional request", expectedAction: "request_more_info", skill: "clarification", policyId: "fictional-policy" };
const evidence: ReviewEvidence = { policyText: "Referral required", requiredDocuments: ["referral"], providedDocuments: [], escalationRequired: false, priorFailures: ["Missed referral"] };
const coach: Coach = async () => ({ action: "approve", response: "Approve.", confidence: 0.9 });
function adapted(skill: "clarification" | "escalation") {
  const profile: UserProfile = { userId: skill, skills: { clarification: 0, escalation: 0, policy_reasoning: 0 }, failures: { clarification: 0, escalation: 0, policy_reasoning: 0 } };
  profile.failures[skill] = 2;
  return evolveHarness(profile, initial);
}

test("same coach and next case produce different behavior for different user histories", async () => {
  const clarifier = adapted("clarification");
  const escalator = adapted("escalation");
  assert.notDeepEqual(clarifier, escalator);
  const a = await runWithHarness(caseData, evidence, clarifier, coach);
  const b = await runWithHarness(caseData, evidence, escalator, coach);
  assert.equal(a.response.action, "request_more_info");
  assert.equal(b.response.action, "approve");
  assert.match(a.response.response, /\?$/);
  assert.deepEqual(a.input.priorFailures, ["Missed referral"]);
  assert.deepEqual(b.input.priorFailures, []);
  assert.deepEqual(a.input.documentationCheck, { missing: ["referral"] });
  assert.deepEqual(a.raw, b.raw);
});

test("context excludes answer key and obeys policy and memory gates", () => {
  const input = buildHarnessInput(caseData, evidence, initial);
  assert.equal("expectedAction" in input.case, false);
  assert.equal("skill" in input.case, false);
  assert.equal(input.documentationCheck, null);
  assert.deepEqual(input.priorFailures, []);
  assert.equal(buildHarnessInput(caseData, evidence, { ...initial, tools: { policyLookup: false, documentationChecker: false } }).policy, null);
  assert.deepEqual(buildHarnessInput(caseData, { ...evidence, priorFailures: ["1", "2", "3", "4"] }, adapted("clarification")).priorFailures, ["2", "3", "4"]);
});

test("unknown documents block approval; complete documents allow it; escalation wins", async () => {
  const harness = { ...adapted("clarification"), requireEscalationCheck: true };
  assert.equal((await runWithHarness(caseData, { ...evidence, providedDocuments: undefined }, harness, coach)).response.action, "request_more_info");
  assert.equal((await runWithHarness(caseData, { ...evidence, providedDocuments: ["referral"] }, harness, coach)).response.action, "approve");
  const result = await runWithHarness(caseData, { ...evidence, escalationRequired: true }, harness, coach);
  assert.equal(result.response.action, "escalate");
  assert.equal(result.response.confidence, 0);
  assert.deepEqual(result.interventions, ["escalation_required"]);
  await assert.rejects(runWithHarness(caseData, evidence, initial, async () => ({ action: "approve", response: "", confidence: 0.9 })), /Invalid/);
});

test("candidate gate accepts improvement, rejects regression and rejects no improvement", async () => {
  const probes = [
    { caseData, evidence },
    { caseData: { ...caseData, id: "complete", expectedAction: "approve" as const }, evidence: { ...evidence, providedDocuments: ["referral"] } },
  ];
  const candidate = adapted("clarification");
  const accepted = await validateHarnessCandidate(initial, candidate, probes, coach);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.beforeCorrect, 1);
  assert.equal(accepted.afterCorrect, 2);
  const rollback = await validateHarnessCandidate(candidate, { ...initial, version: 3 }, probes, coach);
  assert.equal(rollback.accepted, false);
  assert.match(rollback.reason, /regressed/);
  const noGain = await validateHarnessCandidate(initial, adapted("escalation"), probes, coach);
  assert.equal(noGain.accepted, false);
  await assert.rejects(validateHarnessCandidate(initial, candidate, [], coach), /probe/);
  await assert.rejects(validateHarnessCandidate(initial, { ...initial, version: 2 }, probes, coach), /behavior/);
});
