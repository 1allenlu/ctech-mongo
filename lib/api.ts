// Small helpers shared by the API routes in app/api.
import type { AgentResponse } from "@/shared/types";
import type { ReviewerSubmission } from "@/shared/ui-types";

const ACTIONS: AgentResponse["action"][] = ["approve", "request_more_info", "escalate"];

export function parseSubmission(body: unknown): ReviewerSubmission | null {
  const b = body as Partial<ReviewerSubmission> | null;
  if (typeof b?.caseId !== "string" || typeof b.rationale !== "string") return null;
  if (!ACTIONS.includes(b.action as AgentResponse["action"])) return null;
  return { caseId: b.caseId, action: b.action!, rationale: b.rationale };
}

export function errorResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof SyntaxError ? 400 : message.startsWith("Unknown ") ? 404 : 500;
  console.error("[api]", err);
  return Response.json({ error: message }, { status });
}
