import { submitDecision } from "@/lib/backend";
import { errorResponse, parseSubmission } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const submission = parseSubmission(await request.json());
    if (!submission) return Response.json({ error: "Expected { caseId, action, rationale }" }, { status: 400 });
    return Response.json(await submitDecision(submission));
  } catch (err) {
    return errorResponse(err);
  }
}
