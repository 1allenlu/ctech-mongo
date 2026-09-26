# lib/evaluation — Person 3 (Evaluation + evolution)

- `evaluate(caseData, agentResponse): Evaluation`
- `updateUserProfile(profile, evaluation): UserProfile`
- `evolveHarness(profile, harness): HarnessConfig`

Keep these pure: return results, don't write to MongoDB. Saving happens in
`processEvaluationAndEvolve` in `lib/backend.ts`. See the mock versions in
`lib/mocks.ts`. Types: `shared/types.ts`.
