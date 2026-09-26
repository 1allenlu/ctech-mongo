import { getState } from "@/lib/backend";
import { errorResponse } from "@/lib/api";

export async function GET() {
  try {
    return Response.json(await getState());
  } catch (err) {
    return errorResponse(err);
  }
}
