import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, runCase, validateResponse } from './case-agent.js';
import { exampleCase, examplePolicy, exampleContext, harnessV1, harnessV2 } from './fixtures.js';
test('answer key is excluded and disabled tools/memory have no output', () => {
  const context = buildContext(exampleCase, examplePolicy, harnessV1, exampleContext);
  assert.equal(JSON.stringify(context).includes('expectedAction'), false);
  assert.equal(context.documentationCheck, null);
  assert.deepEqual(context.priorFailures, []);
  assert.equal(buildContext(exampleCase, examplePolicy, { ...harnessV1, tools: { policyLookup: false, documentationChecker: false } }).policy, null);
});
test('checker finds absent documents and distinguishes unknown inventory', () => {
  assert.deepEqual(buildContext(exampleCase, examplePolicy, harnessV2, exampleContext).documentationCheck?.missing, ['physical_therapy_record']);
  assert.equal(buildContext(exampleCase, examplePolicy, harnessV2).documentationCheck?.missing, null);
  assert.throws(() => buildContext(exampleCase, { ...examplePolicy, id: 'wrong' }, harnessV1));
});
test('offline demo follows harness changes without a network call', async () => {
  const options = { ...exampleContext, mode: 'mock' as const, fetchImpl: (() => { throw new Error('No network allowed'); }) as typeof fetch };
  const first = await runCase(exampleCase, examplePolicy, harnessV1, options);
  const second = await runCase(exampleCase, examplePolicy, harnessV2, options);
  assert.notEqual(first.response, second.response);
  assert.match(second.response, /\?/);
  assert.match(second.response, /physical_therapy_record/);
});
test('malformed decisions and confidence are rejected', () => {
  for (const value of [null, { action: 'deny', response: 'x', confidence: 0.5 }, { action: 'approve', response: '', confidence: 0.5 }, { action: 'approve', response: 'x', confidence: 2 }]) assert.throws(() => validateResponse(value));
});
test('live transport sends safe context, validates output, and surfaces credit errors', async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-only-placeholder';
  try {
    const fakeFetch: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages[1].content.includes('expectedAction'), false);
      assert.equal(body.response_format.type, 'json_schema');
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ action: 'request_more_info', response: 'Which document is missing?', confidence: 0.8 }) } }] }));
    };
    assert.equal((await runCase(exampleCase, examplePolicy, harnessV2, { fetchImpl: fakeFetch })).confidence, 0.8);
    await assert.rejects(runCase(exampleCase, examplePolicy, harnessV1, { fetchImpl: async () => new Response('', { status: 402 }) }), /HTTP 402/);
    await assert.rejects(runCase(exampleCase, examplePolicy, harnessV1, { fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })) }), /incomplete/);
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});
