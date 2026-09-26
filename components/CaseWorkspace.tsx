"use client";

import { useState } from "react";
import type { AgentResponse, Case, HarnessConfig } from "@/shared/types";
import type { Policy, SubmitResult } from "@/shared/ui-types";
import { ACTION_LABELS, SKILL_LABELS, formatFailure } from "@/lib/format";
import { Card, Pill } from "./ui";

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
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted">
            Case {index + 1} of {total} · {SKILL_LABELS[caseData.skill]}
          </p>
          <Progress index={index} total={total} />
        </div>
        <p className="text-[19px] leading-relaxed">{caseData.scenario}</p>

        {harness.tools.policyLookup && (
          <details open className="group mt-5 border-t border-hairline pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
              <span>
                Policy {policy.id} · {policy.title}
              </span>
              <span className="text-muted transition group-open:rotate-90">›</span>
            </summary>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{policy.text}</p>
          </details>
        )}
      </Card>

      {harness.tools.documentationChecker && docs.length > 0 && (
        <Card title="Document checklist" right={<Pill tone="accent">New</Pill>} className="ring-2 ring-accent/30">
          <ul className="divide-y divide-hairline">
            {docs.map((doc) => {
              const checked = checkedDocs.includes(doc);
              return (
                <li key={doc}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5 text-[15px]">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      disabled={locked}
                      onChange={(e) =>
                        setCheckedDocs((prev) => (e.target.checked ? [...prev, doc] : prev.filter((d) => d !== doc)))
                      }
                    />
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
                        checked ? "border-accent bg-accent" : "border-gray-300"
                      }`}
                    >
                      {checked && "✓"}
                    </span>
                    {doc}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            {checkedDocs.length} of {docs.length} found in the file
          </p>
        </Card>
      )}

      <Card title="Your decision">
        <div role="radiogroup" aria-label="Decision" className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
          {ACTIONS.map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={action === a}
              onClick={() => setAction(a)}
              disabled={locked}
              className={`rounded-lg px-2 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                action === a ? "bg-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>

        <textarea
          aria-label="Note"
          rows={2}
          value={rationale}
          disabled={locked}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Add a note (optional)"
          className="mt-3 w-full resize-none rounded-xl bg-canvas px-4 py-3 text-[15px] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />

        {!result ? (
          <button
            onClick={() => action && onSubmit(action, rationale)}
            disabled={!action || disabled}
            className="mt-3 w-full rounded-full bg-accent px-4 py-3 text-[15px] font-medium text-white transition hover:brightness-110 disabled:opacity-30"
          >
            {submitting ? "Checking…" : "Submit"}
          </button>
        ) : (
          <>
            <Result result={result} expected={caseData.expectedAction} />
            {isLast ? (
              <p className="mt-4 text-center text-sm text-muted">That&apos;s every case. Choose Start over to run it again.</p>
            ) : (
              <button
                onClick={onNext}
                disabled={disabled}
                className="mt-4 w-full rounded-full bg-accent px-4 py-3 text-[15px] font-medium text-white transition hover:brightness-110 disabled:opacity-30"
              >
                Next case
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === index ? "w-5 bg-accent" : i < index ? "w-1.5 bg-ink/40" : "w-1.5 bg-hairline"
          }`}
        />
      ))}
    </div>
  );
}

function Result({ result, expected }: { result: SubmitResult; expected: AgentResponse["action"] }) {
  const { correct, failureType } = result.evaluation;
  const failure = formatFailure(failureType);
  return (
    <div
      role="status"
      aria-label="Decision result"
      className={`mt-4 flex items-start gap-3 rounded-xl p-4 ${correct ? "bg-good-soft" : "bg-bad-soft"}`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
          correct ? "bg-good" : "bg-bad"
        }`}
      >
        {correct ? "✓" : "✕"}
      </span>
      <div>
        <p className={`font-semibold ${correct ? "text-good" : "text-bad"}`}>{correct ? "Correct" : "Not quite"}</p>
        {!correct && (
          <p className="mt-0.5 text-[15px] text-ink">
            {failure.charAt(0).toUpperCase() + failure.slice(1)}. The right call was{" "}
            <span className="font-medium">{ACTION_LABELS[expected].toLowerCase()}</span>.
          </p>
        )}
      </div>
    </div>
  );
}
