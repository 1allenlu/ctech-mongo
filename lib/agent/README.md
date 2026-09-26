# lib/agent — Person 2 (Case agent)

`runCase(caseData, policy, harnessConfig): Promise<AgentResponse>`

Produces the copilot's coaching for a case. The output should visibly change
with the harness: `coachingMode` (direct vs socratic), `includePriorFailures`,
and `tools.documentationChecker`. See `mockRunCase` in `lib/mocks.ts`.

`lib/backend.ts` is the only file that imports from here. Types: `shared/types.ts`.
