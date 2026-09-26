"use client";

import { useEffect, useRef, useState } from "react";
import type { HarnessConfig } from "@/shared/types";
import type { HarnessDiffItem, HarnessVersionRecord } from "@/shared/ui-types";
import { diffHarness } from "@/lib/diff";
import { FIELD_LABELS, formatValue } from "@/lib/format";
import type { Mutation } from "./Dashboard";
import { Badge, Card } from "./ui";

// The three mutable properties, in display order.
const ROWS: { field: string; value: (h: HarnessConfig) => unknown }[] = [
  { field: "coachingMode", value: (h) => h.coachingMode },
  { field: "includePriorFailures", value: (h) => h.includePriorFailures },
  { field: "tools.documentationChecker", value: (h) => h.tools.documentationChecker },
];

export default function HarnessPanel({
  harness,
  history,
  mutation,
}: {
  harness: HarnessConfig;
  history: HarnessVersionRecord[];
  mutation: Mutation | null;
}) {
  const changed = new Set(mutation?.diff.map((d) => d.field));

  return (
    <>
      {mutation && <MutationBanner key={mutation.key} mutation={mutation} />}

      <Card title="Harness" right={<Badge tone={harness.version > 1 ? "violet" : "slate"}>v{harness.version}</Badge>}>
        <dl className="divide-y divide-slate-100">
          {ROWS.map(({ field, value }) => (
            <div
              key={`${field}-${mutation?.key ?? 0}`}
              className={`flex items-center justify-between gap-3 rounded px-2 py-2 ${
                changed.has(field) ? "animate-field-pulse ring-2 ring-amber-300" : ""
              }`}
            >
              <dt className="text-slate-700">{FIELD_LABELS[field]}</dt>
              <dd>
                <Value value={value(harness)} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <HarnessHistory history={history} />
    </>
  );
}

function MutationBanner({ mutation }: { mutation: Mutation }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      className="animate-evolve-in rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-md"
    >
      <p className="text-xl font-bold text-amber-900">
        ⚡ Harness evolved: v{mutation.from} → v{mutation.to}
      </p>
      {mutation.reason && <p className="mt-1 text-amber-900">Why: {mutation.reason}</p>}
      <DiffLines diff={mutation.diff} className="mt-3" />
    </div>
  );
}

function DiffLines({ diff, className = "" }: { diff: HarnessDiffItem[]; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg bg-white font-mono text-sm ring-1 ring-slate-200 ${className}`}>
      {diff.map((d) => (
        <div key={d.field} className="border-b border-slate-100 last:border-0">
          <div className="bg-rose-50 px-3 py-1 text-rose-800">
            − {d.field}: {formatValue(d.from)}
          </div>
          <div className="bg-emerald-50 px-3 py-1 text-emerald-800">
            + {d.field}: {formatValue(d.to)}
          </div>
        </div>
      ))}
    </div>
  );
}

function HarnessHistory({ history }: { history: HarnessVersionRecord[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < history.length ? selected : null;
  const record = index !== null ? history[index] : null;
  const prev = index ? history[index - 1] : null;

  return (
    <Card title="Harness history">
      <ul className="space-y-1">
        {history.map((h, i) => (
          <li key={`${h.config.version}-${h.createdAt}`}>
            <button
              onClick={() => setSelected(index === i ? null : i)}
              aria-expanded={index === i}
              className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${
                index === i ? "bg-slate-50 ring-1 ring-slate-200" : ""
              }`}
            >
              <Badge tone={i > 0 ? "violet" : "slate"}>v{h.config.version}</Badge>
              <span className="flex-1 text-sm">
                <span className="block text-slate-800">{h.reason}</span>
                <span className="block text-xs text-slate-500">{new Date(h.createdAt).toLocaleTimeString()}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {record && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {prev ? (
            <>
              <p className="mb-2 text-sm text-slate-600">
                Changes from v{prev.config.version} to v{record.config.version}:
              </p>
              <DiffLines diff={diffHarness(prev.config, record.config)} />
            </>
          ) : (
            <dl className="space-y-1 text-sm">
              {ROWS.map(({ field, value }) => (
                <div key={field} className="flex justify-between">
                  <dt className="text-slate-600">{FIELD_LABELS[field]}</dt>
                  <dd className="font-mono">{formatValue(value(record.config))}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </Card>
  );
}

function Value({ value }: { value: unknown }) {
  if (typeof value === "boolean") {
    return <Badge tone={value ? "emerald" : "slate"}>{value ? "On" : "Off"}</Badge>;
  }
  return <Badge tone={value === "socratic" ? "violet" : "indigo"}>{String(value)}</Badge>;
}
