import assert from "node:assert/strict";
import { test } from "node:test";
import { demoProgress, demoSequence } from "../lib/demo-sequence";
import type { AppState } from "../shared/ui-types";

test("walkthrough recognizes its sequence and refuses unrelated sessions", () => {
  const state = { cases: demoSequence.map(step => ({ id: step.caseId })), events: [] } as unknown as AppState;
  assert.deepEqual(demoProgress(state), { matches: true, available: true, completed: 0 });
  state.events = demoSequence.map(step => ({ kind: "case", caseId: step.caseId, failure: "Simulated mistake", text: "", ts: "" }));
  assert.equal(demoProgress(state).completed, 4);
  state.events[0].failure = undefined;
  assert.equal(demoProgress(state).matches, false);
  state.cases = [];
  assert.equal(demoProgress(state).available, false);
});
