import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import type { ClientSession, Db, Document, MongoClient, ObjectId } from "mongodb";
import { validateHarness, validateProfile } from "../db/helpers.js";

const collections = ["policies", "cases", "user_profiles", "harness_versions"] as const;
type CollectionName = typeof collections[number];
export type SeedData = Record<CollectionName, Document[]>;
export type SeedPlan = { collection: CollectionName; key: Document; action: "insert" | "preserve" | "conflict"; reason: string }[];

export function loadSeed(): SeedData {
  const data = Object.fromEntries(collections.map(name => [name,
    JSON.parse(readFileSync(new URL(`./draft/${name}.json`, import.meta.url), "utf8")),
  ])) as SeedData;
  validateSeed(data);
  return data;
}

function keyFor(collection: CollectionName, doc: Document): Document {
  if (collection === "user_profiles") return { userId: doc.userId };
  if (collection === "harness_versions") return { userId: doc.userId, version: doc.version };
  return { id: doc.id };
}

function newId(collection: CollectionName, doc: Document): string {
  if (collection === "user_profiles") return `profile:${JSON.stringify(doc.userId)}`;
  if (collection === "harness_versions") return `harness:${JSON.stringify([doc.userId, doc.version])}`;
  return `seed:${collection}:${JSON.stringify(doc.id)}`;
}

export function validateSeed(data: SeedData): void {
  for (const name of collections) {
    if (!Array.isArray(data[name]) || data[name].length === 0) throw new Error(`Missing seed array: ${name}`);
    const keys = new Set<string>();
    for (const doc of data[name]) {
      if (!doc || typeof doc !== "object" || Array.isArray(doc) || "_id" in doc) throw new Error(`Invalid seed document: ${name}`);
      const id = name === "cases" || name === "policies" ? doc.id : doc.userId;
      if (typeof id !== "string" || !id.trim()) throw new Error(`Missing seed identity: ${name}`);
      const key = JSON.stringify(keyFor(name, doc));
      if (keys.has(key)) throw new Error(`Duplicate seed identity: ${name} ${key}`);
      keys.add(key);
    }
  }
  const policyIds = new Set(data.policies.map(p => p.id));
  const userIds = new Set(data.user_profiles.map(p => p.userId));
  for (const policy of data.policies) {
    if (typeof policy.title !== "string" || typeof policy.text !== "string"
      || !Array.isArray(policy.requiredDocumentation) || !policy.requiredDocumentation.every((d: unknown) => typeof d === "string")) throw new Error("Invalid policy seed.");
  }
  for (const c of data.cases) {
    if (!policyIds.has(c.policyId) || typeof c.scenario !== "string"
      || !["approve", "request_more_info", "escalate"].includes(c.expectedAction)
      || !["clarification", "policy_reasoning", "escalation"].includes(c.skill)) throw new Error("Invalid case or policy reference.");
  }
  for (const profile of data.user_profiles) validateProfile(profile as Parameters<typeof validateProfile>[0]);
  for (const harness of data.harness_versions) {
    validateHarness(harness as Parameters<typeof validateHarness>[0]);
    if (!userIds.has(harness.userId)) throw new Error("Harness references an unknown seed reviewer.");
  }
}

export async function planSeed(db: Db, data: SeedData, session?: ClientSession): Promise<SeedPlan> {
  validateSeed(data);
  const plan: SeedPlan = [];
  for (const collection of collections) {
    for (const doc of data[collection]) {
      const key = keyFor(collection, doc);
      const existing = await db.collection(collection).find(key, { session }).limit(2).toArray();
      if (existing.length > 1) {
        plan.push({ collection, key, action: "conflict", reason: "Duplicate business IDs already exist; resolve before seeding." });
      } else if (existing.length === 0) {
        plan.push({ collection, key, action: "insert", reason: "Missing seed document." });
      } else if (collection === "user_profiles" || collection === "harness_versions") {
        plan.push({ collection, key, action: "preserve", reason: "Keep reviewer progress and stored harness history unchanged." });
      } else {
        const { _id, ...stored } = existing[0];
        const same = isDeepStrictEqual(stored, doc);
        plan.push({ collection, key, action: same ? "preserve" : "conflict", reason: same ? "Already seeded." : "Existing content differs; automatic overwrite is disabled." });
      }
    }
  }
  return plan;
}

export async function applySeed(db: Db, client: Pick<MongoClient, "withSession">, data: SeedData): Promise<SeedPlan> {
  // Re-plan within the transaction. Never apply a stale preview or replace existing documents.
  return client.withSession(session => session.withTransaction(async () => {
    const plan = await planSeed(db, data, session);
    if (plan.some(item => item.action === "conflict")) throw new Error("Seed conflicts found; no seed changes applied.");
    for (const item of plan) {
      if (item.action !== "insert") continue;
      const doc = data[item.collection].find(d => isDeepStrictEqual(keyFor(item.collection, d), item.key))!;
      await db.collection<Document & { _id: string | ObjectId }>(item.collection)
        .insertOne({ ...doc, _id: newId(item.collection, doc) }, { session });
    }
    return plan;
  }));
}
