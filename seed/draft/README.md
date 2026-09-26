# Approved seed data — initial insertion completed in Atlas

All policies, thresholds, and scenarios are invented for this training demo. They do not represent real coverage rules or medical advice. No real member information is included.

## Seed contents

Target: `Cluster0` → `hackathon`.

| File / collection | Baseline documents |
| --- | ---: |
| `policies.json` / `policies` | 3 |
| `cases.json` / `cases` | 9 |
| `user_profiles.json` / `user_profiles` | 1 |
| `harness_versions.json` / `harness_versions` | 1 |
| Total | 14 |

These JSON arrays are the approved baseline, already inserted into Atlas. The folder retains its original `draft` name to preserve links. The first insertion used MongoDB-generated `_id` values. The repeatable seed script uses deterministic IDs only for missing records and preserves existing IDs. It does not update, delete, add validators or indexes, or modify `runs`.

Run `npm run seed` for a read-only preview. Run `npm run seed -- --apply` to insert missing records after reviewing the preview. The script identifies policies/cases by `id`, profiles by `userId`, and harness versions by `(userId, version)`. Existing profiles and harness versions are always preserved, even after their values evolve. A conflicting case/policy or duplicate business ID blocks the whole apply. It never resets progress or creates Harness v2. The apply rechecks records inside a transaction before insertion; deterministic IDs prevent duplicate inserts between simultaneous runs of this script. All seed writers should use this script; arbitrary external writes are not protected by business-key indexes.

## Review these design choices

- Cases and user profiles match the existing `shared/type.ts` shapes; that file has not been edited.
- There is no Policy type in that file yet. Proposed policy fields are `id`, `title`, `text`, and `requiredDocumentation` (an array of strings). The `text` contains both document and eligibility rules; a document checklist alone is not an approval decision.
- Skill scores start at **0.5 on the approved 0–1 scale**, as a neutral demo baseline, not an observed assessment. Person 3 should use the same scale. Failure counters start at zero.
- Each stored harness has the agreed HarnessConfig fields plus `userId` to associate it with the reviewer. A data helper can return only HarnessConfig to the agent. Harness v2 is not seeded; it should be created by the evolution logic during the demo.
- Approved coaching behavior: explain requirements before submission, then reveal the expected action and reasoning after submission. See [HARNESS_BEHAVIOR.md](HARNESS_BEHAVIOR.md) for Person 2's implementation specification. This is a local document; it does not add fields or documents to the proposed Atlas seed.
- The intended demo order is ascending `id`: `case-001` through `case-009`. The helpers sort explicitly and use completed training records in `runs` to advance. MongoDB insertion order is not an ordering contract.
- Ground-truth `expectedAction` is for the evaluator. Do not show it to the trainee or include it in the case-agent prompt. This answer key is also review-only.

## Case answer key

| Case | Policy | Skill | Expected action | Reason |
| --- | --- | --- | --- | --- |
| case-001 | imaging | clarification | request_more_info | A verbal treatment history does not replace the missing treatment summary. |
| case-002 | therapy | clarification | request_more_info | The signed referral is missing; the visit total of six is otherwise within the limit. |
| case-003 | reimbursement | clarification | request_more_info | Proof of payment is missing even though the member says they paid. |
| case-004 | imaging | policy_reasoning | approve | All requirements are confirmed; exactly four weeks satisfies the minimum. |
| case-005 | therapy | policy_reasoning | approve | Seven used plus five requested equals twelve, which is allowed. |
| case-006 | reimbursement | policy_reasoning | approve | Exactly ninety days and five hundred dollars satisfy the inclusive limits; all other requirements are met. |
| case-007 | imaging | escalation | escalate | The documented two weeks fails the minimum and the member requests an exception reserved for senior review. |
| case-008 | therapy | escalation | escalate | Ten used plus four requested exceeds twelve; junior reviewers cannot grant the exception. |
| case-009 | reimbursement | escalation | escalate | Conflicting service dates require senior review despite a complete packet. |

## Demo walkthrough

1. Load `demo-reviewer-001` with Harness v1 and `case-001`.
2. Have the demo trainee choose `approve` for cases 001 and 002. Those are simulated mistakes, not seeded outcomes.
3. Person 3's evaluator should classify both as `failureType: "missing_required_documentation"` and increment clarification failures.
4. After two such failures, the evolver creates Harness v2: `coachingMode: "socratic"`, `includePriorFailures: true`, and `tools.documentationChecker: true`. Keep policy lookup enabled.
5. Present case 003 to demonstrate the new coaching. A correct response requests proof of payment.

The current shared Case type has no expected failure category, and the UserProfile type counts failures by skill rather than failure category. For this small demo, all three clarification cases involve missing documentation. Person 3 must explicitly implement the failure classification and trigger; seed data alone does not make evolution happen. Do not assume that any two clarification failures in future cases necessarily mean missing documentation.

## Application status

The user approved and the initial 14 documents were inserted and verified against these files. Subsequent seeding is insert-only. Creating or editing local scripts does not execute Atlas writes; no new live writes were required to build these scripts. See `docs/database-handoff.md` for the read-only example and local persistence tests.
