import type { AgentResponse, Case, Evaluation } from "../shared/type.ts";

export function evaluate(caseData: Case, agentResponse: AgentResponse): Evaluation {
  const correct = caseData.expectedAction === agentResponse.action;
  return {
    correct,
    skill: caseData.skill,
    ...(correct ? {} : { failureType: `${caseData.skill}_incorrect_action` }),
  };
}
