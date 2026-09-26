# Case Agent — Person 2

Requires Node 20.6+; install dependencies with `npm install`.

- `npm run demo`: offline canned responses, no API usage.
- `npm run demo:live`: two OpenRouter calls using credits from the configured account.
- `npm test` and `npm run typecheck`: local verification.

Set `OPENROUTER_API_KEY` in the root `.env`. Optional `OPENROUTER_MODEL` defaults to `openai/gpt-4o-mini`; choose a model supporting structured outputs. Never ship the key to the browser.

## Person 4 integration

```ts
import { runCase } from './agent/case-agent.js';
const coaching = await runCase(caseData, policy, harness, {
  providedDocuments: ['specialist_referral'],
  priorFailures: [{ caseId: 'previous', lesson: 'Check evidence first.' }],
});
```

Call this from your backend. Return `coaching.response` to the trainee. In Socratic mode keep `action` hidden until the trainee submits their own decision. Person 3 should evaluate that trainee decision, not the agent's recommendation.

The original three-argument signature still works. The optional fourth argument supplies prior failure memory and explicit document IDs. Person 1 supplies policy `{ id, text, requiredDocuments }` and document inventory; omitted inventory is unknown, while an empty array means no documents supplied. Shared types are unchanged.

The harness runs deterministic context tools before the model call: policy lookup includes the supplied matching policy only when enabled; documentation checking compares required document IDs with the supplied inventory only when enabled. This is not an autonomous model-selected tool loop. Document presence does not establish clinical eligibility. Memory is limited to the last three supplied lessons; the caller selects relevant lessons.

The offline mock always recommends requesting information and is for wiring/demo only. It is not an insurance rule engine. Live errors fail visibly; no silent mock fallback or retries spend extra credits.

`confidence` means model self-reported confidence (0–1). The shared type's “surprise score” comment needs agreement with Person 3; these are different quantities.

Fictional training data only. Database writes and harness evolution belong to Persons 1 and 3.
