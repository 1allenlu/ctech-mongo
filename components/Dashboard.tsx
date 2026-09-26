"use client";

import { useEffect, useState } from "react";
import type { AgentResponse, HarnessConfig } from "@/shared/types";
import type { AppState, HarnessDiffItem, SubmitResult } from "@/shared/ui-types";
import { api } from "@/lib/client";
import Header from "./Header";
import CaseWorkspace from "./CaseWorkspace";
import CopilotPanel from "./CopilotPanel";
import HarnessPanel from "./HarnessPanel";
import ProfilePanel from "./ProfilePanel";

export type Mutation = { from: number; to: number; diff: HarnessDiffItem[]; reason?: string; key: number };

export default function Dashboard({ showMockIndicator, usingMocks }: { showMockIndicator: boolean; usingMocks: boolean }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The case on screen. Stays on the submitted case until "Next case".
  const [viewIndex, setViewIndex] = useState(0);
  // The result on screen, with the harness the decision was made under.
  const [submitted, setSubmitted] = useState<{ result: SubmitResult; harness: HarnessConfig } | null>(null);
  const result = submitted?.result ?? null;
  const [mutation, setMutation] = useState<Mutation | null>(null);
  const [busy, setBusy] = useState<"submit" | "reset" | null>(null);
  const [preCoaching, setPreCoaching] = useState<{ key: string; coaching: AgentResponse } | null>(null);

  function show(s: AppState) {
    setState(s);
    setViewIndex(s.currentCaseIndex);
    setSubmitted(null);
  }

  useEffect(() => {
    api.state().then(show, (e: Error) => setError(e.message));
  }, []);

  const current = state?.cases[viewIndex];
  const policy = state?.policies.find((p) => p.id === current?.policyId);

  // Socratic coaching is safe to show before the reviewer decides: it asks
  // questions instead of giving the answer. Direct coaching waits for submit.
  const coachKey =
    state && current && !result && state.harness.coachingMode === "socratic"
      ? `${current.id}@v${state.harness.version}`
      : null;

  useEffect(() => {
    if (!coachKey) return;
    let cancelled = false;
    api.coach(coachKey.split("@")[0]).then(
      (coaching) => !cancelled && setPreCoaching({ key: coachKey, coaching }),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [coachKey]);

  const coaching = result?.coaching ?? (preCoaching?.key === coachKey ? preCoaching.coaching : null);

  async function submit(action: AgentResponse["action"], rationale: string) {
    if (!state || !current) return;
    setBusy("submit");
    setError(null);
    try {
      const r = await api.submit({ caseId: current.id, action, rationale });
      setSubmitted({ result: r, harness: state.harness });
      if (r.mutated) {
        setMutation({ from: state.harness.version, to: r.harness.version, diff: r.diff, reason: r.reason, key: Date.now() });
      }
      setState(await api.state());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function next() {
    if (!state) return;
    setViewIndex(state.currentCaseIndex);
    setSubmitted(null);
  }

  async function reset() {
    setBusy("reset");
    setError(null);
    try {
      show(await api.reset());
      setMutation(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isLast = !!state && viewIndex === state.cases.length - 1;
  const mistakeCounts = new Map<string, number>();
  for (const e of state?.events ?? []) if (e.failure) mistakeCounts.set(e.failure, (mistakeCounts.get(e.failure) ?? 0) + 1);
  const recentMistakes = [...mistakeCounts].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label));

  return (
    <div className="flex min-h-screen flex-col">
      <Header showMockIndicator={showMockIndicator} usingMocks={usingMocks} resetting={busy === "reset"} onReset={reset} disabled={!!busy} />

      {error && (
        <div role="alert" className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1400px] rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {!state || !current || !policy ? (
        <p className="p-8 text-center text-sm text-muted">{error ? "" : "Loading…"}</p>
      ) : (
        <main className="mx-auto grid w-full max-w-[1400px] flex-1 items-start gap-5 px-4 py-6 lg:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
          <CaseWorkspace
            key={current.id}
            caseData={current}
            index={viewIndex}
            total={state.cases.length}
            policy={policy}
            harness={submitted?.harness ?? state.harness}
            result={result}
            submitting={busy === "submit"}
            disabled={!!busy}
            isLast={isLast}
            onSubmit={submit}
            onNext={next}
          />
          <CopilotPanel
            harness={state.harness}
            coaching={coaching}
            loading={!!coachKey && !coaching}
            submitted={!!result}
            recentMistakes={recentMistakes}
          />
          <div className="flex flex-col gap-5">
            <HarnessPanel harness={state.harness} history={state.harnessHistory} mutation={mutation} />
            <ProfilePanel profile={state.profile} events={state.events} />
          </div>
        </main>
      )}
    </div>
  );
}
