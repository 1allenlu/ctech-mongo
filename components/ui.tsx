import type { ReactNode } from "react";

export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-300",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-300",
  violet: "bg-violet-50 text-violet-700 ring-violet-300",
  amber: "bg-amber-50 text-amber-800 ring-amber-300",
  rose: "bg-rose-50 text-rose-700 ring-rose-300",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-300",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}
