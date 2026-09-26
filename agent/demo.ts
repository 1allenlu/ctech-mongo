import { runCase } from './case-agent.js';
import { exampleCase, examplePolicy, exampleContext, harnessV1, harnessV2 } from './fixtures.js';
const mode = process.argv.includes('--live') ? 'live' : 'mock';
console.log(`Case Agent demo (${mode}; ${mode === 'live' ? 'uses OpenRouter credits' : 'no API calls'})`);
try {
  for (const harness of [harnessV1, harnessV2]) {
    const response = await runCase(exampleCase, examplePolicy, harness, { ...exampleContext, mode });
    console.log(`\nHarness v${harness.version} (${harness.coachingMode})\n${JSON.stringify(response, null, 2)}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Demo failed.');
  process.exitCode = 1;
}
