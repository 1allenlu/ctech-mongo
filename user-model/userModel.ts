import type { Db } from "mongodb";
import { getDb } from "../shared/mongodb.ts";
import type { Evaluation, UserProfile } from "../shared/type.ts";

const skills = ["clarification", "policy_reasoning", "escalation"] as const;

export async function updateUserProfile(
  userId: string,
  evaluation: Evaluation,
  db?: Db,
): Promise<UserProfile> {
  if (!userId.trim()) throw new Error("userId is required");
  if (!skills.includes(evaluation.skill)) throw new Error("Unknown skill");
  const collection = (db ?? await getDb()).collection<UserProfile & { _id: string }>("user_profiles");
  const incrementPath = `${evaluation.correct ? "skills" : "failures"}.${evaluation.skill}`;
  const defaults: Record<string, string | number> = { userId };
  for (const skill of skills) {
    for (const counter of ["skills", "failures"]) {
      const path = `${counter}.${skill}`;
      if (path !== incrementPath) defaults[path] = 0;
    }
  }
  // The user ID is the unique primary key; increments are atomic.
  const profile = await collection.findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: defaults, $inc: { [incrementPath]: 1 } },
    { upsert: true, returnDocument: "after", includeResultMetadata: false },
  );
  if (!profile) throw new Error("Profile update returned no document");
  return { userId: profile.userId, skills: profile.skills, failures: profile.failures };
}
