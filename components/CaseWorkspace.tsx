"use client";

import { useState } from "react";
import type { AgentResponse, HarnessConfig } from "@/shared/types";
import type { Policy, PublicCase, SubmitResult } from "@/shared/ui-types";
import { ACTION_LABELS, SKILL_LABELS, formatFailure } from "@/lib/format";
import { Card, Label, Pill } from "./ui";

const ACTIONS = Object.keys(ACTION_LABELS) as AgentResponse["action"][];
const STEPS = ["Review", "Decide", "Feedback"];

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
  caseData: PublicCase;
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
  const step = result ? 2 : action ? 1 : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-2xl font-semibold tracking-tight">Case {index + 1}</h3>
            <Pill>{SKILL_LABELS[caseData.skill]}</Pill>
          </div>
          <Dots index={index} total={total} />
        </div>

        <Stepper step={step} />

        <div className="mt-5">
          <Label>Claim</Label>
          <p className="text-[18px] leading-relaxed">{caseData.scenario}</p>
        </div>

        {harness.tools.policyLookup && (
          <div className="mt-5 rounded-xl bg-canvas p-4">
            <Label>
              Policy · {policy.title}
            </Label>
            <p className="text-[15px] leading-relaxed">{policy.text}</p>
            {docs.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted">Requires</span>
                {docs.map((d) => (
                  <span key={d} className="rounded-full bg-white px-2.5 py-0.5 text-xs ring-1 ring-black/[0.06]">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {harness.tools.documentationChecker && docs.length > 0 && (
        <Card title="Document checklist" right={<Pill tone="accent">Added by coach</Pill>} className="ring-2 ring-accent/30">
          <p className="-mt-1 mb-2 text-sm text-muted">Tick each document you can find in the claim.</p>
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
          <p className={`mt-2 text-xs font-medium ${checkedDocs.length < docs.length ? "text-muted" : "text-good"}`}>
            {checkedDocs.length} of {docs.length} found
            {checkedDocs.length < docs.length && " — anything missing means more info is needed"}
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
                action === a ? "bg-white shadow-sm ring-1 ring-black/[0.06]" : "text-muted hover:text-ink"
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
            {submitting ? "Checking…" : action ? `Submit: ${ACTION_LABELS[action]}` : "Choose an action"}
          </button>
        ) : (
          <>
            <Result result={result} />
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

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-4 flex items-center gap-2 text-xs font-medium" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
              i < step ? "bg-ink text-white" : i === step ? "bg-accent text-white" : "bg-canvas text-muted"
            }`}
          >
            {i < step ? "✓" : i + 1}
          </span>
          <span className={i === step ? "text-ink" : "text-muted"}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-hairline" />}
        </li>
      ))}
    </ol>
  );
}

function Dots({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Case ${index + 1} of ${total}`}>
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

function Result({ result }: { result: SubmitResult }) {
  const expected = result.expectedAction;
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
        <p className="mt-0.5 text-[15px] text-ink">
          {correct ? (
            "Nice work. See what the coach says."
          ) : (
            <>
              {failure.charAt(0).toUpperCase() + failure.slice(1)}. The right call was{" "}
              <span className="font-medium">{ACTION_LABELS[expected].toLowerCase()}</span>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
