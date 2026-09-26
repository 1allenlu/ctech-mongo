"use client";

import { useEffect, useRef, useState } from "react";
import type { HarnessConfig } from "@/shared/types";
import type { HarnessDiffItem, HarnessVersionRecord } from "@/shared/ui-types";
import { diffHarness } from "@/lib/diff";
import { FIELD_LABELS, formatValue } from "@/lib/format";
import type { Mutation } from "./Dashboard";
import { Card, Pill } from "./ui";

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
      {mutation && <MutationCard key={mutation.key} mutation={mutation} />}

      <Card title="Harness" right={<Pill tone={harness.version > 1 ? "accent" : "neutral"}>v{harness.version}</Pill>}>
        <dl>
          {ROWS.map(({ field, value }) => (
            <div
              key={`${field}-${mutation?.key ?? 0}`}
              className={`-mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-[15px] ${
                changed.has(field) ? "animate-glow" : ""
              }`}
            >
              <dt>{FIELD_LABELS[field]}</dt>
              <dd className={changed.has(field) ? "font-medium text-accent" : "text-muted"}>{formatValue(value(harness))}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <HarnessHistory history={history} />
    </>
  );
}

function MutationCard({ mutation }: { mutation: Mutation }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <section
      ref={ref}
      role="status"
      aria-label="Harness updated"
      className="animate-rise-in rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(0,113,227,0.15)] ring-2 ring-accent"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">The copilot adapted</h2>
        <Pill tone="accent">
          v{mutation.from} → v{mutation.to}
        </Pill>
      </div>
      {mutation.reason && <p className="mt-1 text-sm text-muted">Because of {mutation.reason}</p>}
      <Changes diff={mutation.diff} className="mt-3" />
    </section>
  );
}

function Changes({ diff, className = "" }: { diff: HarnessDiffItem[]; className?: string }) {
  return (
    <ul className={`divide-y divide-hairline ${className}`}>
      {diff.map((d) => (
        <li key={d.field} className="flex items-center justify-between gap-3 py-2 text-[15px]">
          <span>{FIELD_LABELS[d.field] ?? d.field}</span>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-muted line-through">{formatValue(d.from)}</span>
            <span className="text-muted">→</span>
            <span className="font-semibold text-accent">{formatValue(d.to)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function HarnessHistory({ history }: { history: HarnessVersionRecord[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < history.length ? selected : null;

  return (
    <Card title="History">
      <ul className="-mx-2">
        {history.map((h, i) => (
          <li key={`${h.config.version}-${h.createdAt}`}>
            <button
              onClick={() => setSelected(index === i ? null : i)}
              aria-expanded={index === i}
              disabled={i === 0}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left enabled:hover:bg-canvas"
            >
              <span className="w-6 text-sm font-semibold">v{h.config.version}</span>
              <span className="flex-1 text-sm text-muted">{i === 0 ? "Starting harness" : h.reason}</span>
              <time className="text-xs text-muted">
                {new Date(h.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </time>
            </button>
            {index === i && i > 0 && <Changes diff={diffHarness(history[i - 1].config, h.config)} className="mx-2 mb-2" />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
