# Database helpers: team contract

Target database: `hackathon`. The approved seed is already in Atlas. These helpers are server-side only; never expose the database URI or case answer key to the browser.

## Start here: repeatable seed and one working example

Prerequisite: Node.js 20.19+ (this workspace uses Node 24), `npm ci`, and a private `.env` containing `MONGODB_URI`. The database defaults to `hackathon`; use `MONGODB_DB` to select a different intended target. Never commit or send `.env` in the handoff.

```sh
npm run seed              # Read-only preview: missing, preserved, or conflicting records
npm run seed -- --apply   # Explicit write: insert missing baseline records only
npm run demo:read         # Read-only app connection and demo-data check
npm run typecheck
npm test                 # Local in-memory persistence and seed tests; no Atlas calls
```

Existing profiles and all harness versions survive reseeding. Cases and policies are inserted if missing; conflicting existing content blocks the entire apply. The seed script never writes `runs`, deletes progress, or manufactures Harness v2. The current Atlas seed should need no insertion unless records have since been removed. Always inspect the preview, which prints its target database.

Send teammates these identifiers:

| Item | Value |
| --- | --- |
| Database | `hackathon` |
| Demo reviewer | `demo-reviewer-001` |
| First example case | `case-001` |
| First example policy | `policy-imaging-001` |
| Initial harness | reviewer `demo-reviewer-001`, version `1` |
| Runnable read-only example | `scripts/demo-read.ts` |
| Helper imports | `db/helpers.ts` (use `../db/helpers.js` from sibling TypeScript folders) |

`npm run demo:read` verifies the specific case/policy link, profile, current harness, and available harness history. It also reports the actual next case without resetting progress, and does not print the answer key. If a teammate already completed cases, the next case may no longer be `case-001`.

`npm test` verifies that two simulated wrong submissions persist a changed profile, preserve both v1 and v2, and advance to case 3; it also verifies that reseeding afterward preserves that state. These use a local in-memory adapter, not a real MongoDB server. They do not prove live transaction behavior. An Atlas write-through integration check would require a separately approved test reviewer/database so the shared demo reviewer remains untouched.

That separate live check has now been approved and completed. See the live result below; the paragraph above describes the scope of the local tests.

Verified on 2026-09-26: TypeScript checking and all 13 local tests passed. The read-only preview against `hackathon` reported 0 inserts, 14 preserved documents, and 0 conflicts. The read-only example loaded the demo profile and case/policy pair, reported `case-001` as next, and found harness history `[1]`. No Atlas writes were performed during this verification. Harness v2 exists only in the local test scenarios until the application evolves a live reviewer.

### Approved live integration result

After the earlier read-only verification, the user approved a live demo. On 2026-09-26 it passed against Atlas `hackathon` using a separate reviewer:

`demo-verification-3b5c6a4c-ee7b-4fef-8956-099316266115`

- Created five documents: one profile, two immutable harness versions, and two completed runs.
- Read back the profile after each save; the final clarification failure count is 2 and its fixture score is 0.3.
- Loaded both Harness v1 (direct) and v2 (Socratic, prior failures enabled, documentation checker enabled).
- Verified that `getNextCase` returns `case-003`.
- Retried the second submission and verified `already_completed`, with exactly two run records and no repeated profile update.
- Existing seed data and `demo-reviewer-001` were not written to.

The saved evidence is [live-demo-result.json](live-demo-result.json). This verifies real helper writes, transaction commits, readback, and sequential retry handling. It uses fixed evaluations and harness changes; it does not implement or exercise Person 3's scoring/evolution algorithm or Person 2's coaching model.

The runnable script is `scripts/demo-live.ts`:

```sh
npm run demo:live             # Preview only; no database connection
npm run demo:live -- --apply  # Creates five documents for a fresh test reviewer
```

Each applied run intentionally uses a new test reviewer ID and leaves its records available for inspection. It never resets an existing reviewer. The local result file records the most recent applied run. Live writes require an explicit `--apply`; use the read-only example for routine handoff checks.

## Ownership

To see exactly what evolved, run `npm run harness:diff`. It reads the latest successful local demo report to select the reviewer, then fetches the two most recent harness versions from Atlas. It prints changed settings, plain-language explanations, unchanged settings, and illustrative coaching wording. It performs no writes.

For a specific reviewer/version pair:

```sh
npm run harness:diff -- --user demo-verification-93c4a138-338c-48fc-84a4-1cdd03c8310c --from 1 --to 2
```

If only one version exists, the script says there is no saved evolution yet. The diff describes configuration, not actual model responses or a proven causal explanation for evolution.

- Person 1 retrieves cases/policies and persists the supplied profile, harness, and completion result.
- Person 3 calculates evaluations, skill scores, failure counts, and harness mutations. Persistence must not increment those counts a second time.
- Person 2 applies the harness to coaching. Explain requirements before submission and reveal the expected action only after submission.
- Person 4 calls the server helpers and displays progress.

## Read behavior

- `getNextCase(userId)` returns the first uncompleted case sorted by ascending `id`, or `null` when all cases are completed. Viewing a case does not complete it. Unknown users raise an error rather than silently creating a profile.
- `getPolicy(policyId)` and `getUserProfile(userId)` return a document or `null` if absent.
- `getCurrentHarness(userId)` returns the highest numeric version for that user, without MongoDB `_id` or storage-only `userId`, or `null` if absent.
- `getHarnessVersions(userId)` returns all of that user's harness configurations in ascending version order for the UI's v1/v2 comparison. It returns an empty array if none exist.
- Case IDs in this seed use zero-padded numbers, so sorting by `id` gives the intended demo order.

## Completion record proposed for Person 3

Use the existing `runs` collection. Existing connection-test records remain untouched and do not count toward completion. A training completion has:

```json
{
  "kind": "case_completion",
  "userId": "demo-reviewer-001",
  "caseId": "case-001",
  "status": "completed",
  "harnessVersion": 1,
  "response": { "action": "approve", "response": "I would approve.", "confidence": 0.8 },
  "evaluation": { "correct": false, "skill": "clarification", "failureType": "missing_required_documentation" },
  "completedAt": "server-generated timestamp"
}
```

A submitted, evaluated wrong answer still completes the case. A page view, draft answer, connection test, or failed submission does not. One completion per user/case is sufficient for the demo; repeat attempts and resetting progress are outside this contract.

## Submission flow

1. Load the current case, profile, policy, and harness on the server.
2. Person 3 evaluates the submitted answer and calculates the new profile and any new harness.
3. Save the profile, harness, and completion together using the submission helper. The stored `harnessVersion` identifies the harness used for this answer, not the newly evolved version.
4. Only after persistence succeeds, reveal feedback and retrieve the next case. Retries of the same completion must not apply the profile update twice.

Standalone `saveUserProfile(profile)` is for an explicit profile save, and `saveHarnessVersion(userId, harness)` stores an immutable version. Normal case submissions should use the combined save to avoid a case being completed while its profile update is missing.

## Team decision to confirm

Person 3 should confirm the `kind: "case_completion"` run shape and `failureType: "missing_required_documentation"` spelling. The helpers will accept calculated results; they will not implement the scoring or evolution algorithm.

## Using the TypeScript implementation

The implementation is in `db/helpers.ts`; no HTTP endpoints or UI are included. It uses the existing `MONGODB_URI` environment variable and defaults `MONGODB_DB` to `hackathon`. Set those on the backend only. Importing the module does not connect or write; calls to read helpers perform reads, and calls to save helpers perform writes.

```ts
import {
  getNextCase, getPolicy, getUserProfile, getCurrentHarness,
  saveCompletedSubmission,
} from "../db/helpers.js";

const userId = "demo-reviewer-001"; // In a real endpoint derive this from the authenticated session.
const caseData = await getNextCase(userId);
if (!caseData) { /* Show training complete. */ }
else {
  const policy = await getPolicy(caseData.policyId);
  const previousProfile = await getUserProfile(userId);
  const currentHarness = await getCurrentHarness(userId);
  if (!policy || !previousProfile || !currentHarness) throw new Error("Missing demo setup");

  // Person 3 supplies these calculations; these functions are not part of this module.
  // Keep previousProfile unchanged. Pass a clone to code that may mutate a profile.
  // const evaluation = await evaluate(caseData, submittedResponse);
  // const profile = calculateProfile(structuredClone(previousProfile), evaluation);
  // const harness = await evolveHarness(profile, currentHarness);
  // const result = await saveCompletedSubmission({
  //   userId, caseId: caseData.id, harnessVersion: currentHarness.version,
  //   response: submittedResponse, evaluation, previousProfile, profile, harness,
  // });
  // On "saved", return post-submission feedback and the next case.
  // On "already_completed", do not apply scoring again or treat a different answer as a new attempt.
}
```

Person 3's `updateUserProfile` should return the calculated profile or delegate persistence to this module, not independently save before `saveCompletedSubmission`. Pass the previously loaded profile as `previousProfile` so stale calculations can be rejected. On a stale-profile/harness error, reload and recalculate. The submission helper validates structure and ordering, but Person 3 remains responsible for the correctness of the evaluation and score calculation.

`saveCompletedSubmission` records a server timestamp and commits all writes in a MongoDB transaction. The existing Atlas cluster supports the required replica-set topology. For other environments, use a replica set; a standalone MongoDB server cannot run this transaction flow. Driver reference: https://www.mongodb.com/docs/drivers/node/current/crud/transactions/

Harness versions are immutable: saving an identical version is a no-op, while changing its content is an error. During submissions, the supplied harness must keep the current version unchanged or create version `current + 1`. The standalone profile save is a full replacement of supplied profile fields; use it for explicit setup/admin saves, not concurrent scoring updates. Concurrent calls to standalone setup/version saves can report a duplicate-key error; reload the record before retrying. Deterministic IDs protect documents created by these helpers without automatically adding Atlas indexes. All application writers should use the same helpers; writes outside them could create duplicate business IDs.

Checks: `npm run typecheck` and `npm test`. Unit tests use an in-memory adapter and never access Atlas. They cover order, user isolation, completion retries, stale submissions, version immutability, and the case-001 → case-003 demo. The approved live demo above additionally verified transaction commits and sequential retries against Atlas with a separate test reviewer. Concurrent submission races and injected transaction failures have not been exercised against Atlas.
