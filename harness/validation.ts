import type { Case, HarnessConfig } from "../shared/type.ts";
import { getHarnessDiff } from "./evolver.ts";
import { runWithHarness, type Coach, type ReviewEvidence } from "./runtime.ts";

export type HarnessProbe = { caseData: Case; evidence: ReviewEvidence };

// Caller supplies held-out fictional probes and the SAME coach for both versions.
// This measures recommendation correctness on those probes, not human learning.
export async function validateHarnessCandidate(
  before: HarnessConfig, candidate: HarnessConfig, probes: HarnessProbe[], coach: Coach,
) {
  if (!probes.length) throw new Error("At least one held-out probe is required");
  if (candidate.version !== before.version + 1) throw new Error("Candidate must increment version by one");
  if (!Object.keys(getHarnessDiff(before, candidate)).some(field => field !== "version")) {
    throw new Error("Candidate must change behavior, not only version");
  }
  const results = [];
  for (const probe of probes) {
    const baseline = await runWithHarness(probe.caseData, probe.evidence, before, coach);
    const proposed = await runWithHarness(probe.caseData, probe.evidence, candidate, coach);
    results.push({
      caseId: probe.caseData.id,
      expectedAction: probe.caseData.expectedAction,
      beforeAction: baseline.response.action,
      afterAction: proposed.response.action,
      beforeCorrect: baseline.response.action === probe.caseData.expectedAction,
      afterCorrect: proposed.response.action === probe.caseData.expectedAction,
      interventions: proposed.interventions,
    });
  }
  const beforeCorrect = results.filter(result => result.beforeCorrect).length;
  const afterCorrect = results.filter(result => result.afterCorrect).length;
  const regression = results.some(result => result.beforeCorrect && !result.afterCorrect);
  const accepted = !regression && afterCorrect > beforeCorrect;
  return {
    accepted, beforeCorrect, afterCorrect, total: probes.length, results,
    reason: accepted ? `Accepted: probe correctness improved from ${beforeCorrect}/${probes.length} to ${afterCorrect}/${probes.length} with no per-case regression.`
      : regression ? "Rejected: candidate regressed on a previously correct probe."
      : "Rejected: candidate did not improve probe correctness.",
  };
}
