"use client";

import { useState } from "react";
import type { AgentResponse, Case, HarnessConfig } from "@/shared/types";
import type { Policy, SubmitResult } from "@/shared/ui-types";
import { ACTION_LABELS, SKILL_LABELS, formatFailure } from "@/lib/format";
import { Badge, Card } from "./ui";

const ACTIONS = Object.keys(ACTION_LABELS) as AgentResponse["action"][];

export default function CaseWorkspace({
  caseData,
  index,
  total,
  policy,
  harness,
  result,
  submitting,
  disabled,
  isLast,
  onSubmit,
  onNext,
}: {
  caseData: Case;
  index: number;
  total: number;
  policy: Policy;
  harness: HarnessConfig;
  result: SubmitResult | null;
  submitting: boolean;
  disabled: boolean;
  isLast: boolean;
  onSubmit: (action: AgentResponse["action"], rationale: string) => void;
  onNext: () => void;
}) {
  const [action, setAction] = useState<AgentResponse["action"] | null>(null);
  const [rationale, setRationale] = useState("");
  const [checkedDocs, setCheckedDocs] = useState<string[]>([]);
  const locked = !!result || disabled;
  const docs = policy.requiredDocs ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-2xl font-bold">
            Case {index + 1} <span className="text-slate-400">of {total}</span>
          </h2>
          <Badge tone="indigo">{SKILL_LABELS[caseData.skill]}</Badge>
          <Badge>Policy {policy.id}</Badge>
        </div>
        <p className="text-lg leading-relaxed text-slate-800">{caseData.scenario}</p>
      </Card>

      {harness.tools.policyLookup && (
        <Card>
          <details open>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-500">
              Policy {policy.id}: {policy.title}
            </summary>
            <p className="mt-3 leading-relaxed text-slate-700">{policy.text}</p>
          </details>
        </Card>
      )}

      {harness.tools.documentationChecker && docs.length > 0 && (
        <Card
          title="Documentation checklist"
          right={<Badge tone="violet">New tool</Badge>}
          className="border-violet-300 ring-2 ring-violet-200"
        >
          <p className="mb-3 text-sm text-slate-600">Tick each required document you can find in the member&apos;s file.</p>
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc}>
                <label className="flex cursor-pointer items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-violet-600"
                    checked={checkedDocs.includes(doc)}
                    disabled={locked}
                    onChange={(e) =>
                      setCheckedDocs((prev) => (e.target.checked ? [...prev, doc] : prev.filter((d) => d !== doc)))
                    }
                  />
                  {doc}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium text-slate-700">
            {checkedDocs.length} of {docs.length} confirmed
          </p>
        </Card>
      )}

      <Card title="Your decision">
        <div className="grid gap-2 sm:grid-cols-3">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              disabled={locked}
              aria-pressed={action === a}
              className={`rounded-lg border-2 px-3 py-3 text-base font-semibold transition disabled:cursor-not-allowed ${
                action === a
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:border-indigo-400 disabled:opacity-60"
              }`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="rationale">
          Rationale
        </label>
        <textarea
          id="rationale"
          rows={3}
          value={rationale}
          disabled={locked}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why did you choose this action?"
          className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
        />

        {!result ? (
          <button
            onClick={() => action && onSubmit(action, rationale)}
            disabled={!action || disabled}
            className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit decision"}
          </button>
        ) : (
          <>
            <ResultBanner result={result} expected={caseData.expectedAction} />
            {isLast ? (
              <p className="mt-3 text-center text-slate-600">All cases done. Press Reset demo to run it again.</p>
            ) : (
              <button
                onClick={onNext}
                disabled={disabled}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Next case →
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ResultBanner({ result, expected }: { result: SubmitResult; expected: AgentResponse["action"] }) {
  const { correct, failureType } = result.evaluation;
  return (
    <div
      role="status"
      aria-label="Decision result"
      className={`mt-4 rounded-lg border-2 px-4 py-3 ${
        correct ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-rose-400 bg-rose-50 text-rose-900"
      }`}
    >
      <p className="text-lg font-bold">{correct ? "✅ Correct" : `❌ Incorrect: ${formatFailure(failureType)}`}</p>
      {!correct && <p className="mt-1">Expected action: {ACTION_LABELS[expected]}</p>}
    </div>
  );
}
