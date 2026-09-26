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
    <section
      className={`rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] ${className}`}
    >
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-[15px] font-semibold">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Heading above each dashboard column.
export function ColumnTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>;
}

// Small label above a block inside a card.
export function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-muted">{children}</p>;
}

const PILL_TONES = {
  neutral: "bg-canvas text-muted",
  accent: "bg-accent-soft text-accent",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof PILL_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}
