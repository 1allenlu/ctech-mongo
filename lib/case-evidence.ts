import type { Case } from "../shared/types";
import cases from "../seed/draft/cases.json";
import policies from "../seed/draft/policies.json";

const reasons = ["An explicit exception to the four-week treatment requirement is requested.", "Ten used visits plus four requested visits exceed the twelve-visit limit.", "The invoice and proof of payment list conflicting service dates."];
// Authored from the fictional narratives, not from expectedAction. Only exact known
// narratives are enriched, so edited Atlas cases do not inherit stale evidence.
export function withCaseEvidence(caseData: Case): Case {
  const index = cases.findIndex(c => c.id === caseData.id && c.scenario === caseData.scenario && c.policyId === caseData.policyId);
  if (index < 0) return caseData;
  const docs = policies.find(p => p.id === caseData.policyId)!.requiredDocumentation;
  const provided = index < 3 ? docs.slice(0, -1) : docs;
  // Therapy case 2 has a treatment plan, but no clinician referral.
  return { ...caseData, providedDocuments: caseData.providedDocuments ?? (index === 1 ? docs.slice(1) : provided),
    escalationRequired: caseData.escalationRequired ?? index >= 6,
    escalationReason: caseData.escalationReason ?? (index >= 6 ? reasons[index - 6] : undefined) };
}
