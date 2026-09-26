# PolicyPilot: agent instructions

PolicyPilot trains junior insurance reviewers on fictional cases. Keep changes
small and preserve the distinction between reviewer evaluation, model coaching,
and harness adaptation.

## Stack and framework guidance

- Next.js 16.3.6 App Router, React 19.2.8, TypeScript 5, Tailwind CSS 4.
- MongoDB Node.js driver 7.6.0; ESM project; Node.js 22.18+.
- Check `package.json` for current versions and scripts.
- Before changing Next.js behavior, read the relevant bundled guide under
  `node_modules/next/dist/docs/`. This version may differ from familiar APIs.
- Preserve the Next.js TypeScript configuration and frontend scripts when merging
  backend changes.

## Setup and execution modes

- Run `npm install`. Create a local `.env` if needed; preserve existing values.
- `MONGODB_URI` supplies the Atlas connection. `MONGODB_DB` optionally selects the
  database; the default is `hackathon`.
- The website defaults to mocks unless `USE_MOCKS=false`. Mock mode uses in-memory
  state and canned coaching; setting an API key alone does not activate live mode.
- Live mode requires `MONGODB_URI` and `OPENROUTER_API_KEY`. `OPENROUTER_MODEL` is
  optional and defaults to `openai/gpt-4o-mini`.
- Website coaching falls back to canned output on model errors or after its
  10-second limit. Preserve the live/mock/fallback and storage indicators.
- Keep credentials server-side. Never print or commit `.env` contents or keys.
- Reuse the existing connection helpers in `shared/mongodb.ts` and
  `db/connection.ts`; do not add a client for every request. Close connections at
  script/server shutdown, not after each operation. `closeBackend()` closes both.

## Commands

- `npm run dev`: development server. Reuse an existing server for this directory
  instead of launching duplicates.
- `npm run build` / `npm run start`: production build/start.
- `npm run build -- --webpack`: alternative build when Turbopack has local worker
  issues. `npm run dev -- --webpack` is also available.
- `npm run lint`: ESLint; `npm run typecheck`: TypeScript checks.
- `npm test`: offline unit tests via `tsx`; no Atlas writes or live model calls.
- `npm run test:integration`: real MongoDB persistence test; creates a unique test
  user and cleans up that user's records.
- `npm run seed`: read-only seed preview. `npm run seed -- --apply` inserts missing
  seed records; inspect conflicts rather than overwriting existing data.
- `npm run demo`, `npm run demo:read`, `npm run demo:live`, and
  `npm run harness:diff`: database/demo utilities. Inspect their scripts and flags
  before execution; do not assume all demos are read-only.
- `npm run agent:demo`: offline coach demo.
- `npm run agent:demo:live`: live OpenRouter requests using API credits, without
  the website's canned fallback.
- `npm run demo:harness`: deterministic two-reviewer showcase. Writes profiles,
  accepted mutations, and accepted/rejected experiments to Atlas under unique
  user IDs and retains them for inspection. It does not call an LLM.

## Application pipeline

The UI/API orchestration lives in `lib/backend.ts`.

1. `evaluate(caseData, agentResponse)` grades the reviewer's selected action
   against the fictional case's expected action. It does not grade wording or
   confidence. The reviewer decision is represented as an `AgentResponse`.
2. `updateUserProfile` increments per-user correct-answer or failure counters in
   `user_profiles`. These are cumulative counts, not calibrated proficiency.
3. `evolveHarness` proposes configuration changes. Two clarification failures
   enable Socratic coaching, prior-failure context, and document checking. Two
   escalation failures enable `requireEscalationCheck`. Policy-reasoning failures
   currently have no evolution rule.
4. The UI runs `validateHarnessCandidate` on the fixed probes in
   `harness/probes.ts`. Acceptance requires increased action correctness and no
   regression on any previously correct probe. These are deterministic guardrail
   checks, not a live-model benchmark or evidence of improved human learning.
5. Record both accepted and rejected candidates in `harness_experiments` in live
   mode, or memory in mock mode. Only accepted candidates become active versions.
6. `saveHarnessVersion(userId, before, after, reason)` saves snapshots, a diff,
   version transition, reason, and timestamp in `harness_versions`. Versions must
   be consecutive positive integers; duplicate user/target versions fail.
7. `agent/case-agent.ts` builds harness-dependent model instructions and context.
   `runWithHarness` applies runtime guardrails to live and fallback recommendations.
   Escalation takes precedence over document checking. Unknown evidence is not
   treated as complete or clear.

## Boundaries and limitations

- Canonical shared types are in `shared/types.ts`; `shared/type.ts` re-exports them.
- Keep the case answer key out of live model context and pre-decision API results.
  Supply checking evidence independently of `expectedAction`.
- `lib/case-evidence.ts` enriches exact known fictional narratives with authored
  document and escalation evidence. Do not apply those defaults to edited cases.
- Keep simulations, fallback responses, and probe results clearly labeled.
  Harness proposals use deterministic rules, not a self-writing model agent.
- Process one training turn per user at a time. The UI uses the shared
  `demo-reviewer` identity; concurrent sessions can interfere.
- Profile updates, experiment records, and active-version writes in the UI flow
  are separate operations, not a transaction. Retries can duplicate counters;
  account for partial failures before adding automatic retries.
- Reapplying an already-active adaptation must not increment its version.
- Do not commit generated `.next/`, `node_modules/`, `next-env.d.ts`, or
  `*.tsbuildinfo` files.
- Validate changes with relevant tests and type checking. For UI/build changes,
  verify the build when practical and report any unverified live dependencies.
