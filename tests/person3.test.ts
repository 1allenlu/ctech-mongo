import assert from "node:assert/strict";
import { test } from "node:test";
import type { Db } from "mongodb";
import { evaluate } from "../evaluator/evaluator.ts";
import { evolveHarness, getHarnessDiff, saveHarnessVersion } from "../harness/evolver.ts";
import { updateUserProfile } from "../user-model/userModel.ts";
import type { Case, HarnessConfig, UserProfile } from "../shared/type.ts";

const base = (): HarnessConfig => ({ version: 1, coachingMode: "direct", includePriorFailures: false, tools: { policyLookup: true, documentationChecker: false } });
const profile = (): UserProfile => ({ userId: "junior", skills: { clarification: 0, policy_reasoning: 0, escalation: 0 }, failures: { clarification: 0, policy_reasoning: 0, escalation: 0 } });

test("all expected/actual action combinations are evaluated deterministically", () => {
  const actions = ["approve", "request_more_info", "escalate"] as const;
  for (const skill of ["clarification", "policy_reasoning", "escalation"] as const) {
    for (const expectedAction of actions) for (const action of actions) {
      const caseData: Case = { id: "case", scenario: "Fictional", policyId: "policy", skill, expectedAction };
      assert.deepEqual(evaluate(caseData, { action, response: "", confidence: 0.1 }), {
        correct: action === expectedAction, skill,
        ...(action === expectedAction ? {} : { failureType: `${skill}_incorrect_action` }),
      });
    }
  }
});

test("evolution thresholds, combined rules, immutability and repeat calls", () => {
  const user = profile();
  const original = base();
  user.failures.clarification = 1;
  user.failures.escalation = 1;
  assert.deepEqual(evolveHarness(user, original), original);
  user.failures.clarification = 2;
  const clarified = evolveHarness(user, original);
  assert.equal(clarified.version, 2);
  assert.equal(clarified.coachingMode, "socratic");
  assert.equal(clarified.includePriorFailures, true);
  assert.equal(clarified.tools.documentationChecker, true);
  assert.equal(clarified.tools.policyLookup, true);
  assert.deepEqual(original, base());
  assert.deepEqual(evolveHarness(user, clarified), clarified);
  user.failures.escalation = 2;
  const combined = evolveHarness(user, original);
  assert.equal(combined.version, 2);
  assert.equal(combined.requireEscalationCheck, true);
  assert.equal(evolveHarness(user, clarified).version, 3);
  user.failures.clarification = 0;
  assert.equal(evolveHarness(user, original).coachingMode, "direct");
  assert.equal(evolveHarness(user, original).requireEscalationCheck, true);
});

// In-memory boundary fake: exercises the persistence contract without Atlas writes.
function fakeDb() {
  const users = new Map<string, Record<string, any>>();
  const history = new Map<string, any>();
  const db = { collection(name: string) {
    if (name === "user_profiles") return {
      async findOneAndUpdate(filter: any, update: any, options: any) {
        assert.equal(options.upsert, true);
        assert.equal(options.returnDocument, "after");
        let user = users.get(filter._id);
        const setPath = (target: any, path: string, value: any) => {
          const [a, b] = path.split(".");
          if (b) (target[a] ??= {})[b] = value;
          else target[a] = value;
        };
        if (!user) {
          user = { _id: filter._id };
          for (const [path, value] of Object.entries(update.$setOnInsert)) {
            assert.ok(!(path in update.$inc), "MongoDB update paths must not conflict");
            setPath(user, path, value);
          }
        }
        for (const [path, value] of Object.entries(update.$inc)) {
          const [a, b] = path.split(".");
          setPath(user, path, (user[a]?.[b] ?? 0) + Number(value));
        }
        users.set(filter._id, user);
        return structuredClone(user);
      },
    };
    assert.equal(name, "harness_versions");
    return { async insertOne(doc: any) {
      if (history.has(doc._id)) throw new Error("duplicate version");
      history.set(doc._id, structuredClone(doc));
    } };
  } } as unknown as Db;
  return { db, history };
}

test("profiles initialize every counter and accumulate results independently per user", async () => {
  const { db } = fakeDb();
  const first = await updateUserProfile("junior", { correct: false, skill: "clarification" }, db);
  assert.deepEqual(first, { ...profile(), failures: { ...profile().failures, clarification: 1 } });
  await updateUserProfile("junior", { correct: false, skill: "clarification" }, db);
  const updated = await updateUserProfile("junior", { correct: true, skill: "clarification" }, db);
  assert.equal(updated.skills.clarification, 1);
  assert.equal(updated.failures.clarification, 2);
  const other = await updateUserProfile("other", { correct: true, skill: "escalation" }, db);
  assert.equal(other.failures.clarification, 0);
  assert.equal(other.skills.escalation, 1);
});

test("diff returns only changed fields, including optional guardrails", () => {
  assert.deepEqual(getHarnessDiff(base(), base()), {});
  assert.deepEqual(getHarnessDiff(base(), { ...base(), requireEscalationCheck: true }), {
    requireEscalationCheck: { before: null, after: true },
  });
  assert.deepEqual(getHarnessDiff({ ...base(), requireEscalationCheck: true }, base()), {
    requireEscalationCheck: { before: true, after: null },
  });
});

test("history keeps before/after snapshots, diffs, reasons and timestamps", async () => {
  const { db, history } = fakeDb();
  const before = base();
  const user = profile();
  user.failures.clarification = 2;
  const after = evolveHarness(user, before);
  const expectedBefore = structuredClone(before);
  const expectedAfter = structuredClone(after);
  await saveHarnessVersion("junior", before, after, "Two clarification failures", db);
  before.tools.policyLookup = false;
  after.tools.documentationChecker = false;
  await saveHarnessVersion("other", expectedBefore, expectedAfter, "Two clarification failures", db);
  const saved = history.get(JSON.stringify(["junior", 2]));
  assert.deepEqual(saved.before, expectedBefore);
  assert.deepEqual(saved.after, expectedAfter);
  assert.equal(saved.fromVersion, 1);
  assert.equal(saved.toVersion, 2);
  assert.deepEqual(saved.changes, {
    version: { before: 1, after: 2 },
    coachingMode: { before: "direct", after: "socratic" },
    includePriorFailures: { before: false, after: true },
    "tools.documentationChecker": { before: false, after: true },
  });
  assert.equal(saved.reason, "Two clarification failures");
  assert.ok(saved.timestamp instanceof Date);
  assert.equal(history.size, 2);
  await assert.rejects(saveHarnessVersion("junior", expectedBefore, expectedAfter, "Overwrite", db), /duplicate/);
  await assert.rejects(saveHarnessVersion("junior", expectedBefore, expectedAfter, " ", db), /required/);
  await assert.rejects(saveHarnessVersion("junior", expectedBefore, expectedBefore, "No version change", db), /increment/);
});
