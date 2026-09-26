import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import test from "node:test";
import type { Db, MongoClient } from "mongodb";
import { createHelpers, validateProfile, type CompletedSubmission } from "../db/helpers.js";
import { applySeed, loadSeed, planSeed, validateSeed } from "../seed/seed.js";

type Row = Record<string, any>;
// In-memory adapter: unit tests only, not a substitute for real transaction integration tests.
function fixture() {
  let data: Record<string, Row[]> = {};
  for (const name of ["cases", "policies", "user_profiles", "harness_versions"]) {
    data[name] = JSON.parse(readFileSync(new URL(`../seed/draft/${name}.json`, import.meta.url), "utf8"))
      .map((row: Row, i: number) => ({ ...row, _id: `${name}-${i}` }));
  }
  data.cases.reverse(); // Prove ordering does not depend on insertion order.
  data.runs = [{ task: "connection test", status: "working" }];
  function matches(row: Row, query: Row) {
    return Object.entries(query).every(([key, value]) => value && typeof value === "object" && "$nin" in value
      ? !value.$nin.includes(row[key]) : isDeepStrictEqual(row[key], value));
  }
  const db = { collection(name: string) { return {
    find(query: Row) {
      let rows = data[name].filter(row => matches(row, query));
      return {
        limit(count: number) { rows = rows.slice(0, count); return this; },
        sort(order: Row) {
          const [key, direction] = Object.entries(order)[0] as [string, number];
          rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * direction);
          return this;
        },
        async toArray() { return structuredClone(rows); },
      };
    },
    async findOne(query: Row, options: Row = {}) {
      const rows = data[name].filter(row => matches(row, query));
      if (options.sort) {
        const [key, direction] = Object.entries(options.sort)[0] as [string, number];
        rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * direction);
      }
      return rows.length ? structuredClone(rows[0]) : null;
    },
    async distinct(key: string, query: Row) { return [...new Set(data[name].filter(row => matches(row, query)).map(row => row[key]))]; },
    async replaceOne(query: Row, replacement: Row, options: Row = {}) {
      const index = data[name].findIndex(row => matches(row, query));
      if (index >= 0) data[name][index] = structuredClone(replacement);
      else if (options.upsert) data[name].push(structuredClone(replacement));
    },
    async insertOne(row: Row) {
      if (data[name].some(existing => existing._id === row._id)) throw new Error("Duplicate ID");
      data[name].push(structuredClone(row));
    },
  }; } } as unknown as Db;
  const client = { async withSession(callback: any) {
    return callback({ async withTransaction(work: any) {
      const before = structuredClone(data);
      try { return await work(); } catch (error) { data = before; throw error; }
    } });
  } } as unknown as Pick<MongoClient, "withSession">;
  return { helpers: createHelpers(db, client), db, client, data: () => data };
}

async function submission(helpers: ReturnType<typeof createHelpers>): Promise<CompletedSubmission> {
  const userId = "demo-reviewer-001";
  const previousProfile = (await helpers.getUserProfile(userId))!;
  const profile = structuredClone(previousProfile);
  profile.failures.clarification += 1;
  return {
    userId, caseId: "case-001", harnessVersion: 1, previousProfile, profile,
    harness: (await helpers.getCurrentHarness(userId))!,
    response: { action: "approve", response: "Approve", confidence: 0.8 },
    evaluation: { correct: false, skill: "clarification", failureType: "missing_required_documentation" },
  };
}

test("viewing does not advance; sorting is explicit; unknown users fail", async () => {
  const { helpers } = fixture();
  assert.equal((await helpers.getNextCase("demo-reviewer-001"))?.id, "case-001");
  assert.equal((await helpers.getNextCase("demo-reviewer-001"))?.id, "case-001");
  await assert.rejects(helpers.getNextCase("missing"), /Unknown reviewer/);
});

test("wrong submissions advance once, and retries do not overwrite progress", async () => {
  const { helpers, data } = fixture();
  const input = await submission(helpers);
  assert.equal(await helpers.saveCompletedSubmission(input), "saved");
  assert.equal(await helpers.saveCompletedSubmission(input), "already_completed");
  assert.equal((await helpers.getNextCase(input.userId))?.id, "case-002");
  assert.equal((await helpers.getUserProfile(input.userId))?.failures.clarification, 1);
  assert.equal(data().runs.length, 2);
  assert.equal(data().runs[0].task, "connection test");
});

test("other users' completions and non-completion runs do not advance this user", async () => {
  const { helpers, data } = fixture();
  data().runs.push({ userId: "other", caseId: "case-001", kind: "case_completion", status: "completed" });
  data().runs.push({ userId: "demo-reviewer-001", caseId: "case-001", status: "completed", kind: "test" });
  assert.equal((await helpers.getNextCase("demo-reviewer-001"))?.id, "case-001");
});

test("all completed returns null", async () => {
  const { helpers, data } = fixture();
  data().runs.push(...data().cases.map(c => ({ userId: "demo-reviewer-001", caseId: c.id, kind: "case_completion", status: "completed" })));
  assert.equal(await helpers.getNextCase("demo-reviewer-001"), null);
});

test("harness history is immutable and latest version is numeric", async () => {
  const { helpers, data } = fixture();
  const v1 = (await helpers.getCurrentHarness("demo-reviewer-001"))!;
  assert.equal("userId" in v1, false);
  assert.equal("_id" in v1, false);
  await helpers.saveHarnessVersion("demo-reviewer-001", v1);
  await assert.rejects(helpers.saveHarnessVersion("demo-reviewer-001", { ...v1, coachingMode: "socratic" }), /different content/);
  await helpers.saveHarnessVersion("demo-reviewer-001", { ...v1, version: 2 });
  await helpers.saveHarnessVersion("demo-reviewer-001", { ...v1, version: 10 });
  assert.equal((await helpers.getCurrentHarness("demo-reviewer-001"))?.version, 10);
  assert.equal(data().harness_versions.length, 3);
});

test("stale profiles and out-of-order cases are rejected without changing progress", async () => {
  const { helpers } = fixture();
  const input = await submission(helpers);
  await assert.rejects(helpers.saveCompletedSubmission({ ...input, caseId: "case-002" }), /next uncompleted/);
  await helpers.saveUserProfile({ ...input.profile, skills: { ...input.profile.skills, clarification: 0.7 } });
  await assert.rejects(helpers.saveCompletedSubmission(input), /Profile changed/);
  assert.equal((await helpers.getNextCase(input.userId))?.id, "case-001");
});

test("a harness conflict aborts the submission including its profile write", async () => {
  const { helpers } = fixture();
  const input = await submission(helpers);
  await assert.rejects(helpers.saveCompletedSubmission({ ...input, harness: { ...input.harness, coachingMode: "socratic" } }), /different content/);
  assert.deepEqual(await helpers.getUserProfile(input.userId), input.previousProfile);
  assert.equal((await helpers.getNextCase(input.userId))?.id, "case-001");
});

test("two failures persist v2 for case 3 while keeping the harness used for case 2", async () => {
  const { helpers, data } = fixture();
  const first = await submission(helpers);
  await helpers.saveCompletedSubmission(first);
  const second = await submission(helpers);
  second.caseId = "case-002";
  second.harness = { version: 2, coachingMode: "socratic", includePriorFailures: true, tools: { policyLookup: true, documentationChecker: true } };
  await helpers.saveCompletedSubmission(second);
  assert.equal((await helpers.getNextCase(second.userId))?.id, "case-003");
  assert.equal((await helpers.getCurrentHarness(second.userId))?.version, 2);
  assert.equal((await helpers.getUserProfile(second.userId))?.failures.clarification, 2);
  assert.equal(data().runs.find(r => r.caseId === "case-002")?.harnessVersion, 1);
  assert.deepEqual((await helpers.getHarnessVersions(second.userId)).map(h => h.version), [1, 2]);
  assert.equal((await helpers.getHarnessVersions(second.userId))[0].coachingMode, "direct");
});

test("seed preview is read-only; first apply inserts 14 and repeated apply inserts zero", async () => {
  const { db, client, data } = fixture();
  for (const name of ["policies", "cases", "user_profiles", "harness_versions"]) data()[name] = [];
  const seed = loadSeed();
  const before = structuredClone(data());
  const preview = await planSeed(db, seed);
  assert.equal(preview.filter(p => p.action === "insert").length, 14);
  assert.deepEqual(data(), before);
  await applySeed(db, client, seed);
  const after = structuredClone(data());
  assert.equal((await applySeed(db, client, seed)).filter(p => p.action === "insert").length, 0);
  assert.deepEqual(data(), after);
  assert.equal(data().runs.length, 1);
});

test("reseeding preserves reviewer progress, case completions, and both harness versions", async () => {
  const { helpers, db, client, data } = fixture();
  const first = await submission(helpers);
  await helpers.saveCompletedSubmission(first);
  const second = await submission(helpers);
  second.caseId = "case-002";
  second.harness = { ...second.harness, version: 2, coachingMode: "socratic", includePriorFailures: true };
  await helpers.saveCompletedSubmission(second);
  const before = structuredClone(data());
  await applySeed(db, client, loadSeed());
  assert.deepEqual(data(), before);
  assert.equal((await helpers.getNextCase(second.userId))?.id, "case-003");
  assert.deepEqual((await helpers.getHarnessVersions(second.userId)).map(h => h.version), [1, 2]);
});

test("conflicting content or duplicate business IDs block the whole seed", async () => {
  const { db, client, data } = fixture();
  data().policies = []; // Missing records must not be inserted when any other record conflicts.
  data().cases[0].scenario = "Edited by a teammate";
  const before = structuredClone(data());
  assert.ok((await planSeed(db, loadSeed())).some(p => p.action === "conflict"));
  await assert.rejects(applySeed(db, client, loadSeed()), /conflicts/);
  assert.deepEqual(data(), before);
  data().user_profiles.push({ ...data().user_profiles[0], _id: "duplicate" });
  assert.ok((await planSeed(db, loadSeed())).some(p => p.collection === "user_profiles" && p.action === "conflict"));
});

test("seed identities and policy links are validated before any database work", () => {
  const duplicate = loadSeed();
  duplicate.cases.push({ ...duplicate.cases[0] });
  assert.throws(() => validateSeed(duplicate), /Duplicate/);
  const badReference = loadSeed();
  badReference.cases[0].policyId = "missing";
  assert.throws(() => validateSeed(badReference), /policy reference/);
});

test("missing lookups return null and invalid scores are rejected", async () => {
  const { helpers } = fixture();
  assert.equal(await helpers.getPolicy("missing"), null);
  assert.equal(await helpers.getUserProfile("missing"), null);
  assert.equal(await helpers.getCurrentHarness("missing"), null);
  const profile = (await helpers.getUserProfile("demo-reviewer-001"))!;
  profile.skills.clarification = 2;
  assert.throws(() => validateProfile(profile), /between 0 and 1/);
});
