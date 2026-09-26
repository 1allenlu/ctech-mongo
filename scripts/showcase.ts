import { randomUUID } from "node:crypto";
import { evaluate } from "../evaluator/evaluator.ts";
import { evolveHarness, getHarnessDiff, saveHarnessVersion } from "../harness/evolver.ts";
import { runWithHarness, type Coach } from "../harness/runtime.ts";
import { validateHarnessCandidate, type HarnessProbe } from "../harness/validation.ts";
import { closeMongoDB, getDb } from "../shared/mongodb.ts";
import type { HarnessConfig } from "../shared/type.ts";
import { updateUserProfile } from "../user-model/userModel.ts";

const initial: HarnessConfig = { version: 1, coachingMode: "direct", includePriorFailures: false, tools: { policyLookup: true, documentationChecker: false } };
// Deliberately weak, fixed coach: isolates the effect of the harness. No LLM is called.
const coach: Coach = async () => ({ action: "approve", response: "Approve this fictional request.", confidence: 0.8 });
const probes: HarnessProbe[] = [
  { caseData: { id: "probe-documents", scenario: "A fictional request lacks a referral.", expectedAction: "request_more_info", skill: "clarification", policyId: "fictional-v1" }, evidence: { policyText: "Require referral; escalate flagged cases.", requiredDocuments: ["referral"], providedDocuments: [], escalationRequired: false } },
  { caseData: { id: "probe-escalation", scenario: "A fictional request needs senior review.", expectedAction: "escalate", skill: "escalation", policyId: "fictional-v1" }, evidence: { policyText: "Require referral; escalate flagged cases.", requiredDocuments: ["referral"], providedDocuments: ["referral"], escalationRequired: true } },
  { caseData: { id: "probe-complete", scenario: "All fictional criteria are satisfied.", expectedAction: "approve", skill: "policy_reasoning", policyId: "fictional-v1" }, evidence: { policyText: "Require referral; escalate flagged cases.", requiredDocuments: ["referral"], providedDocuments: ["referral"], escalationRequired: false } },
];
const runId = `showcase-${randomUUID()}`;
try {
  const db = await getDb();
  console.log("Deterministic harness showcase (no live LLM). Atlas records are retained under:", runId);
  for (const [index, name] of ["clarification-reviewer", "escalation-reviewer"].entries()) {
    const userId = `${runId}-${name}`;
    let profile;
    for (let attempt = 1; attempt <= 2; attempt++) {
      // Training cases are separate from held-out probes.
      const trainingCase = { ...probes[index].caseData, id: `training-${name}-${attempt}`, scenario: `Fictional training exercise ${attempt} for ${name}.` };
      profile = await updateUserProfile(userId, evaluate(trainingCase, { action: "approve", response: "Approve", confidence: 0.8 }));
    }
    const candidate = evolveHarness(profile!, initial);
    const validation = await validateHarnessCandidate(initial, candidate, probes, coach);
    const reason = `Two ${probes[index].caseData.skill} failures. ${validation.reason}`;
    // Record rejected attempts too, separately from active version history.
    await db.collection("harness_experiments").insertOne({ userId, before: initial, candidate, validation, reason, timestamp: new Date() });
    if (validation.accepted) await saveHarnessVersion(userId, initial, candidate, reason);
    const active = validation.accepted ? candidate : initial;
    // Exactly the same next case and coach for both reviewers.
    const next = await runWithHarness(probes[0].caseData, { ...probes[0].evidence, priorFailures: [`Repeated ${probes[index].caseData.skill} mistakes`] }, active, coach);
    console.log(JSON.stringify({ userId, failures: profile!.failures, changes: getHarnessDiff(initial, active), validation, sameNextCase: next }, null, 2));
    // Demonstrate a rejected rollback: removing learned behavior loses a correct probe.
    const rollback = { ...initial, tools: { ...initial.tools }, version: active.version + 1 };
    const rejected = await validateHarnessCandidate(active, rollback, probes, coach);
    await db.collection("harness_experiments").insertOne({ userId, before: active, candidate: rollback, validation: rejected, reason: rejected.reason, timestamp: new Date() });
    console.log("Rollback candidate:", rejected.reason, "Active version remains", active.version);
  }
} finally {
  await closeMongoDB();
}
