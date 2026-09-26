import type { Db } from "mongodb";
import { getDb } from "../shared/mongodb.ts";
import type { HarnessConfig, UserProfile } from "../shared/type.ts";

export function evolveHarness(userProfile: UserProfile, currentHarness: HarnessConfig): HarnessConfig {
  const next = { ...currentHarness, tools: { ...currentHarness.tools } };
  if (userProfile.failures.clarification >= 2) {
    next.coachingMode = "socratic";
    next.includePriorFailures = true;
    next.tools.documentationChecker = true;
  }
  if (userProfile.failures.escalation >= 2) next.requireEscalationCheck = true;

  const changed = next.coachingMode !== currentHarness.coachingMode
    || next.includePriorFailures !== currentHarness.includePriorFailures
    || next.tools.documentationChecker !== currentHarness.tools.documentationChecker
    || next.requireEscalationCheck !== currentHarness.requireEscalationCheck;
  if (changed) next.version = currentHarness.version + 1;
  return next;
}

export type HarnessDiff = Record<string, { before: string | number | boolean | null; after: string | number | boolean | null }>;

export function getHarnessDiff(before: HarnessConfig, after: HarnessConfig): HarnessDiff {
  const changes: HarnessDiff = {};
  function compare(left: Record<string, unknown>, right: Record<string, unknown>, prefix = ""): void {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const path = prefix ? `${prefix}.${key}` : key;
      const oldValue = left[key];
      const newValue = right[key];
      if (oldValue === newValue) continue;
      if (oldValue && newValue && typeof oldValue === "object" && typeof newValue === "object") {
        compare(oldValue as Record<string, unknown>, newValue as Record<string, unknown>, path);
      } else {
        // Null represents an absent optional field and survives BSON serialization.
        changes[path] = {
          before: (oldValue ?? null) as string | number | boolean | null,
          after: (newValue ?? null) as string | number | boolean | null,
        };
      }
    }
  }
  compare(before, after);
  return changes;
}

export async function saveHarnessVersion(
  userId: string,
  before: HarnessConfig,
  after: HarnessConfig,
  reason: string,
  db?: Db,
): Promise<void> {
  if (!userId.trim() || !reason.trim()) throw new Error("userId and reason are required");
  if (!Number.isInteger(before.version) || before.version < 1
    || !Number.isInteger(after.version) || after.version !== before.version + 1) {
    throw new Error("Harness mutation must increment a positive version by one");
  }
  // Capture snapshots before waiting for the database connection.
  const mutation = {
    _id: JSON.stringify([userId, after.version]),
    userId,
    fromVersion: before.version,
    toVersion: after.version,
    before: structuredClone(before),
    after: structuredClone(after),
    changes: getHarnessDiff(before, after),
    reason,
    timestamp: new Date(),
  };
  const collection = (db ?? await getDb()).collection<typeof mutation>("harness_versions");
  // A unique ID prevents a saved mutation from being overwritten. Duplicates fail.
  await collection.insertOne(mutation);
}
