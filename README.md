# Evaluation and Harness Evolution

Requires Node.js 22.18+ and `npm install`. Uses the existing `.env` `MONGODB_URI` and `hackathon` database from `test_db.py`; optionally set `MONGODB_DB`. The TypeScript runtime shares one MongoClient across calls (the Python/VS Code connection cannot itself be shared across processes).

```ts
import { evaluate } from "./evaluator/evaluator.ts";
import { updateUserProfile } from "./user-model/userModel.ts";
import { evolveHarness, saveHarnessVersion } from "./harness/evolver.ts";

const evaluation = evaluate(caseData, agentResponse);
const profile = await updateUserProfile(userId, evaluation);
const nextHarness = evolveHarness(profile, currentHarness);
if (nextHarness.version !== currentHarness.version) {
  await saveHarnessVersion(userId, currentHarness, nextHarness, "Recurring failures: " + JSON.stringify(profile.failures));
}
// Pass nextHarness to the coach for the next case.
```

- Evaluation compares actions only; it does not grade response wording or confidence.
- Skill scores count correct answers; failures count incorrect answers cumulatively. Each call records one attempt (retries are not deduplicated).
- Two clarification failures enable Socratic coaching, prior failures, and the documentation checker. Two escalation failures set `requireEscalationCheck: true`; the consuming coach must honor this flag by checking escalation criteria before finalizing an action.
- Evolution preserves inputs and increments the version once per configuration change. Repeating evolution with an already adapted harness does not increment it again.
- `user_profiles` stores atomic counters keyed by user ID. `harness_versions` stores each mutation with `userId`, `fromVersion`, `toVersion`, `before`, `after`, `changes`, `reason`, and `timestamp`. Call `saveHarnessVersion(userId, before, after, reason)` with consecutive positive versions. Saving the same user/target version twice fails instead of overwriting history. `getHarnessDiff(before, after)` returns only changed fields (including version), using dotted paths and `{ before, after }` values; absent optional fields use `null`. Existing history records are not migrated.
- Process one training turn per user at a time for this MVP. Profile updates and history writes are separate operations; concurrent harness evolution/version allocation is not implemented.
- Call `closeMongoDB()` from `shared/mongodb.ts` when shutting down a script/server.

Run `npm test` and `npm run typecheck`. Tests use a small in-memory database boundary fake and do not write to Atlas. Persistence functions accept an optional final `Db` argument for testing or an existing TypeScript app connection.

Run `npm run test:integration` to exercise two failed clarification cases against the configured MongoDB database. This requires `MONGODB_URI` (loaded from `.env`) and verifies the persisted profile and evolved harness. It uses a unique test user and deletes only that user's records afterward. `npm test` remains database-free.
