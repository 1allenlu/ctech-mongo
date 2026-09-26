// Browser-side calls to the API routes in app/api.
import type { AgentResponse } from "@/shared/types";
import type { AppState, ReviewerSubmission, SubmitResult } from "@/shared/ui-types";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    path,
    body === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
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
