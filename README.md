# PolicyPilot

PolicyPilot is an adaptive training coach for junior health-insurance reviewers. It learns from mistakes on fictional cases and adjusts its coaching style, memory, document checks, and escalation guardrails, with versioned harness history in MongoDB Atlas.

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

## Harness showcase

Run `npm run demo:harness` with the existing Atlas `.env` configured. It creates two uniquely named fictional reviewers, records two different mistake patterns through the real evaluator/profile functions, proposes configurations with `evolveHarness`, and tests each candidate on the same three probes. It then runs the same next case with each accepted harness and prints the actual context, raw response, guardrail intervention, and final response.

The demo deliberately uses one fixed, weak coach that always recommends approval. It makes no LLM call: improvements demonstrate harness enforcement, not model intelligence or improved human learning. The proposal mechanism is the existing deterministic rules, not an LLM mutation agent. Probes are small synthetic examples, not a general quality benchmark.

`harness/runtime.ts` exports `runWithHarness(caseData, evidence, harness, coach)`. Pass a teammate's model adapter as the `coach` callback; it receives answer-key-free case data, style instructions, gated policy/memory context, and enabled check results. Supply document inventory and escalation criteria from the fictional case/policy layer, never from `expectedAction`. Unknown document inventory is treated as unknown, not complete. Escalation overrides take precedence over documentation overrides. Raw responses and interventions are returned for audit. The action is a backend recommendation; show only appropriate coaching text to a trainee before they decide. Socratic style is instructed but arbitrary model output is not fully style-validated.

`harness/validation.ts` exports `validateHarnessCandidate(before, candidate, probes, coach)`. It accepts a candidate only when action correctness improves and no previously correct probe regresses. Use the same model/settings for both runs; with a live stochastic model, repeat measurements before drawing strong conclusions. Failed model calls throw and prevent promotion.

The demo saves accepted mutations using the existing `saveHarnessVersion` function and records both accepted and rejected attempts with probe evidence in `harness_experiments`. It also proposes removing the learned behavior and shows that this regression is rejected. The UI submission pipeline now validates every candidate before saving an active version. Both outcomes are saved in `harness_experiments` in Atlas mode, or memory in mock mode. Atlas demo records are retained under the printed unique run prefix for inspection; this does not alter existing demo users. Unit tests remain offline.

Policy-change detection and a live model-powered proposal agent are not implemented in this showcase.

The app coaching path now applies the runtime guardrails to both live and fallback responses. Cases can provide `providedDocuments` and `escalationRequired`; missing escalation status remains unknown and blocks approval when the escalation guardrail is enabled. The UI also uses the candidate gate and displays its most recent result, labeled as deterministic guardrail probes rather than a live-model benchmark.

The coach panel reports live/mock/fallback execution, Atlas/in-memory storage, and runtime interventions. Known fictional case narratives receive explicit authored evidence through `lib/case-evidence.ts`; changed or unknown narratives are not enriched. Enabled escalation checks focus coaching on the supplied escalation reason even when the original recommendation was already escalation. These deterministic checks verify harness enforcement and do not establish improved live-model quality or human learning. Existing saved versions are not retroactively revalidated.

## Manual demo sequence

Use Start over, then choose Approve on cases 1 and 2 to trigger the clarification adaptation. Choose Request more info on case 3 and Approve on cases 4–6. Choose Approve on cases 7 and 8 to trigger the escalation adaptation, then Escalate on case 9. The incorrect answers are intentional for demonstrating v1 → v2 → v3; every mutation still passes through the normal validation gate.
