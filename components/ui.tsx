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
    <section className={`rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
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
