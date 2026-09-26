"use client";

import { useEffect, useRef, useState } from "react";
import type { HarnessDiffItem, HarnessVersionRecord } from "@/shared/ui-types";
import { diffHarness } from "@/lib/diff";
import { FIELD_LABELS, formatValue } from "@/lib/format";
import type { Mutation } from "./Dashboard";
import { Card, Pill } from "./ui";

export function MutationCard({ mutation }: { mutation: Mutation }) {
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
        <h3 className="text-lg font-semibold">The coach adapted</h3>
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

export function HarnessHistory({ history }: { history: HarnessVersionRecord[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < history.length ? selected : null;

  return (
    <Card title="Coach history">
      <ol className="relative ml-1 border-l border-hairline">
        {history.map((h, i) => (
          <li key={`${h.config.version}-${h.createdAt}`} className="relative pl-4">
            <span
              aria-hidden
              className={`absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                i === history.length - 1 ? "bg-accent" : "bg-gray-300"
              }`}
            />
            <button
              onClick={() => setSelected(index === i ? null : i)}
              aria-expanded={index === i}
              disabled={i === 0}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left enabled:hover:bg-canvas"
            >
              <span className="text-sm font-semibold">v{h.config.version}</span>
              <span className="flex-1 text-sm text-muted">{i === 0 ? "Starting settings" : h.reason}</span>
              <time className="text-xs text-muted">
                {new Date(h.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </time>
            </button>
            {index === i && i > 0 && <Changes diff={diffHarness(history[i - 1].config, h.config)} className="mx-2 mb-2" />}
          </li>
        ))}
      </ol>
      {history.length > 1 && <p className="mt-2 text-xs text-muted">Select a version to see what changed.</p>}
    </Card>
  );
}
