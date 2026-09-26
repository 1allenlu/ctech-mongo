"use client";

import { useEffect, useState } from "react";
import type { AgentResponse, HarnessConfig } from "@/shared/types";
import type { AppState, Coaching, HarnessDiffItem, SubmitResult } from "@/shared/ui-types";
import { api } from "@/lib/client";
import Header from "./Header";
import CaseWorkspace from "./CaseWorkspace";
import CoachPanel from "./CoachPanel";
import { HarnessHistory, MutationCard } from "./HarnessPanel";
import { ActivityCard, SkillsCard } from "./ProfilePanel";
import StatsBar from "./StatsBar";
import { ColumnTitle } from "./ui";

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
  const [preCoaching, setPreCoaching] = useState<{ key: string; coaching: Coaching } | null>(null);

  function show(s: AppState) {
    setState(s);
    setViewIndex(s.currentCaseIndex);
    setSubmitted(null);
  }

  function fetchState() {
    api.state().then(show, (e: Error) => setError(e.message));
  }

  function retry() {
    setError(null);
    fetchState();
  }

  useEffect(fetchState, []);

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
      if (r.validation && !r.validation.accepted) setMutation(null);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Past mistakes, grouped: "missing required documentation ×2".
  const mistakeCounts = new Map<string, number>();
  for (const e of state?.events ?? []) if (e.failure) mistakeCounts.set(e.failure, (mistakeCounts.get(e.failure) ?? 0) + 1);
  const pastMistakes = [...mistakeCounts].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label));
  const topMistake = [...mistakeCounts].sort((a, b) => b[1] - a[1])[0]?.[0];

  const caseEvents = (state?.events ?? []).filter((e) => e.kind === "case");

  return (
    <div className="flex min-h-screen flex-col">
      <Header showMockIndicator={showMockIndicator} usingMocks={usingMocks} resetting={busy === "reset"} onReset={reset} disabled={!!busy} />

      {error && (
        <div
          role="alert"
          className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-[1400px] items-center justify-between gap-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad"
        >
          <span>{error}</span>
          <button onClick={state ? () => setError(null) : retry} className="shrink-0 font-medium hover:underline">
            {state ? "Dismiss" : "Try again"}
          </button>
        </div>
      )}

      {!state || !current || !policy ? (
        <p className="p-8 text-center text-sm text-muted">{error ? "" : "Loading…"}</p>
      ) : (
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
          <StatsBar
            stats={{
              answered: caseEvents.length,
              total: state.cases.length,
              correct: caseEvents.filter((e) => !e.failure).length,
              mistakes: caseEvents.filter((e) => e.failure).length,
              topMistake,
              version: state.harness.version,
              adaptations: state.harnessHistory.length - 1,
            }}
          />

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr_1fr]">
            <div className="flex flex-col gap-3">
              <ColumnTitle>Case</ColumnTitle>
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
            </div>

            <div className="flex flex-col gap-3 lg:sticky lg:top-[4.5rem]">
              <ColumnTitle>Coach</ColumnTitle>
              <CoachPanel
                harness={state.harness}
                coaching={coaching}
                loading={!!coachKey && !coaching}
                submitted={!!result}
                pastMistakes={pastMistakes}
                changedFields={new Set(mutation?.diff.map((d) => d.field))}
                changeKey={mutation?.key ?? 0}
              />
            </div>

            <div className="flex flex-col gap-3">
              <ColumnTitle>Progress</ColumnTitle>
              <div className="flex flex-col gap-4">
                {state.latestValidation && <section role="status" className="rounded-2xl bg-white p-5 ring-1 ring-hairline">
                  <h3 className="font-semibold">Candidate v{state.latestValidation.toVersion}: {state.latestValidation.accepted ? "Accepted" : "Rejected"}</h3>
                  <p className="mt-2 text-sm">Probe accuracy: {state.latestValidation.beforeCorrect}/{state.latestValidation.total} → {state.latestValidation.afterCorrect}/{state.latestValidation.total}</p>
                  <p className="mt-2 text-sm">{state.latestValidation.reason}</p>
                  <p className="mt-2 text-xs text-muted">Deterministic guardrail probes · not a live-model benchmark. Active harness: v{state.harness.version}.</p>
                </section>}
                {mutation && <MutationCard key={mutation.key} mutation={mutation} />}
                <SkillsCard profile={state.profile} />
                <HarnessHistory history={state.harnessHistory} />
                <ActivityCard events={state.events} />
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
