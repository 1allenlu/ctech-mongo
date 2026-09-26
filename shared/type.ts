export type Case = {
  id: string;
  scenario: string;
  expectedAction: "approve" | "request_more_info" | "escalate";
  skill: "clarification" | "policy_reasoning" | "escalation";
  policyId: string;
};

export type AgentResponse = {
  action: "approve" | "request_more_info" | "escalate";
  response: string;
  confidence: number; // surprise score
};

export type Evaluation = {
  correct: boolean;
  skill: Case["skill"];
  failureType?: string;
};

export type UserProfile = {
  userId: string;
  skills: {
    clarification: number;
    policy_reasoning: number;
    escalation: number;
  };
  failures: {
    clarification: number;
    policy_reasoning: number;
    escalation: number;
  };
};

export type HarnessConfig = {
  // The consuming coach should check escalation criteria before finalizing an action.
  requireEscalationCheck?: boolean;
  version: number;
  coachingMode: "direct" | "socratic";
  includePriorFailures: boolean;
  tools: {
    policyLookup: boolean;
    documentationChecker: boolean;
  };
};