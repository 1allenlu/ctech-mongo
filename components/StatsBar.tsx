import type { ReactNode } from "react";

export type Stats = {
  answered: number;
  total: number;
  correct: number;
  mistakes: number;
  topMistake?: string;
  version: number;
  adaptations: number;
};

export default function StatsBar({ stats }: { stats: Stats }) {
  const { answered, total, correct, mistakes, topMistake, version, adaptations } = stats;
  const accuracy = answered ? Math.round((correct / answered) * 100) : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Progress" value={`${answered} / ${total}`} note="cases reviewed">
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </Tile>
      <Tile
        label="Accuracy"
        value={accuracy === null ? "—" : `${accuracy}%`}
        note={answered ? `${correct} of ${answered} correct` : "no decisions yet"}
        tone={accuracy === null ? undefined : accuracy >= 70 ? "good" : "bad"}
      />
      <Tile
        label="Mistakes"
        value={String(mistakes)}
        note={topMistake ? `most often: ${topMistake}` : "none so far"}
        tone={mistakes > 0 ? "bad" : undefined}
      />
      <Tile
        label="Coach"
        value={`Harness v${version}`}
        note={adaptations ? `adapted ${adaptations === 1 ? "once" : `${adaptations} times`} to you` : "starting settings"}
        tone={adaptations ? "accent" : undefined}
      />
    </div>
  );
}

const TONES = { good: "text-good", bad: "text-bad", accent: "text-accent" };

function Tile({
  label,
  value,
  note,
  tone,
  children,
}: {
  label: string;
  value: string;
  note: string;
  tone?: keyof typeof TONES;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${tone ? TONES[tone] : ""}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{note}</p>
      {children}
    </div>
  );
}
