import { getCoaching } from "@/lib/backend";
import { errorResponse } from "@/lib/api";

// Coaching before the reviewer submits, so Case 3 can show the new harness up front.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.caseId !== "string") return Response.json({ error: "Expected { caseId }" }, { status: 400 });
    return Response.json(await getCoaching(body.caseId));
  } catch (err) {
    return errorResponse(err);
  }
}
