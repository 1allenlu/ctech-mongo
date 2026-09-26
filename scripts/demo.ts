// Runs the demo sequence against the mock backend and checks each step.
// Usage: npm run demo
import assert from "node:assert/strict";
import { getState, submitDecision, resetDemo } from "@/lib/backend";

async function main() {
  process.env.USE_MOCKS = "true";
  let state = await resetDemo();
  assert.equal(state.harness.version, 1);
  console.log("Start: Harness v1 (direct, no prior failures, no doc checker)\n");

  // Cases 1 and 2: the reviewer approves without noticing the missing documentation.
  for (const n of [1, 2]) {
    const c = state.cases[state.currentCaseIndex];
    const r = await submitDecision({ caseId: c.id, action: "approve", rationale: "Looks routine." });
    assert.equal(r.evaluation.correct, false);
    assert.equal(r.evaluation.failureType, "missing_documentation");
    console.log(`Case ${n} (${c.id}): ❌ ${r.evaluation.failureType}, harness v${r.harness.version}`);

    if (n === 1) assert.equal(r.mutated, false);
    if (n === 2) {
      assert.equal(r.mutated, true);
      assert.equal(r.harness.version, 2);
      console.log(`\nHarness evolved: v1 → v2 (${r.reason})`);
      for (const d of r.diff) console.log(`  ${d.field.padEnd(28)} ${d.from} → ${d.to}`);
      assert.deepEqual(
        r.diff.map((d) => d.field).sort(),
        ["coachingMode", "includePriorFailures", "tools.documentationChecker"],
      );
    }
    state = await getState();
    assert.equal(state.profile.failures.clarification, n);
    assert.equal(state.harnessHistory.length, n === 2 ? 2 : 1);
  }
  assert.equal(state.harness.version, 2);
  assert.equal(state.harnessHistory[1].reason, "2 clarification mistakes (missing required documentation)");

  // Case 3: coaching is now Socratic, references past failures, and shows the checklist.
  const c3 = state.cases[state.currentCaseIndex];
  const r3 = await submitDecision({ caseId: c3.id, action: "request_more_info", rationale: "Clinical notes missing." });
  assert.equal(r3.evaluation.correct, true);
  assert.equal(r3.mutated, false);
  assert.match(r3.coaching.response, /missed required documentation/);
  assert.match(r3.coaching.response, /\?/);
  assert.match(r3.coaching.response, /Checklist/);
  console.log(`\nCase 3 (${c3.id}): ✅ correct. Coaching with Harness v${r3.harness.version}:`);
  console.log(r3.coaching.response.replace(/^/gm, "  "));

  console.log("\nEvents:");
  for (const e of (await getState()).events) console.log(`  ${e.text}`);

  // Reset returns to v1 and case 1.
  state = await resetDemo();
  assert.equal(state.harness.version, 1);
  assert.equal(state.currentCaseIndex, 0);
  console.log("\nReset: back to Harness v1, case 1. Demo sequence OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
