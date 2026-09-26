import type { Case, HarnessConfig } from '../shared/type.js';
import type { Policy } from './case-agent.js';
export const exampleCase: Case = {
  id: 'fictional-mri-01', policyId: 'fictional-mri', skill: 'clarification', expectedAction: 'request_more_info',
  scenario: 'A fictional member requests MRI coverage. They report a specialist referral and four weeks of physical therapy, but only the referral document is attached.',
};
export const examplePolicy: Policy = {
  id: 'fictional-mri',
  text: 'Fictional training policy: MRI approval requires a specialist referral and documentation of at least four weeks of physical therapy. Request more information when evidence is missing. Escalate contradictory evidence.',
  requiredDocuments: ['specialist_referral', 'physical_therapy_record'],
};
export const harnessV1: HarnessConfig = { version: 1, coachingMode: 'direct', includePriorFailures: false, tools: { policyLookup: true, documentationChecker: false } };
export const harnessV2: HarnessConfig = { version: 2, coachingMode: 'socratic', includePriorFailures: true, tools: { policyLookup: true, documentationChecker: true } };
export const exampleContext = {
  providedDocuments: ['specialist_referral'],
  priorFailures: [{ caseId: 'fictional-previous', lesson: 'Check supporting documents before recommending approval.' }],
};
