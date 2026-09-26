import { resetDemo } from "@/lib/backend";
import { errorResponse } from "@/lib/api";

export async function POST() {
  try {
    return Response.json(await resetDemo());
  } catch (err) {
    return errorResponse(err);
  }
}
