// Browser-side calls to the API routes in app/api.
import type { AgentResponse } from "@/shared/types";
import type { AppState, ReviewerSubmission, SubmitResult } from "@/shared/ui-types";

// Longer than the server's own limits (5s database, 10s coach), so those answer first.
const REQUEST_TIMEOUT_MS = 20_000;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("The server took too long to respond. Try again.");
    }
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  state: () => call<AppState>("/api/state"),
  submit: (submission: ReviewerSubmission) => call<SubmitResult>("/api/submit", submission),
  reset: () => call<AppState>("/api/reset", {}),
  coach: (caseId: string) => call<AgentResponse>("/api/coach", { caseId }),
};
