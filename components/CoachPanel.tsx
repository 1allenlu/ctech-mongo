import type { AgentResponse, HarnessConfig } from "@/shared/types";
import { ACTION_LABELS, FIELD_LABELS, HARNESS_ROWS, formatValue } from "@/lib/format";
import { Card, Label, Pill } from "./ui";

export default function CoachPanel({
  harness,
  coaching,
  loading,
  submitted,
  pastMistakes,
  changedFields,
  changeKey,
}: {
  harness: HarnessConfig;
  coaching: AgentResponse | null;
  loading: boolean;
  submitted: boolean;
  pastMistakes: string[];
  changedFields: Set<string>;
  changeKey: number;
}) {
  const socratic = harness.coachingMode === "socratic";

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-indigo-500 text-lg text-white">
          ✦
        </span>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold">Coach</h3>
          <p className="text-xs text-muted">{socratic ? "Asks guiding questions" : "Gives direct answers"}</p>
        </div>
        <Pill tone={harness.version > 1 ? "accent" : "neutral"}>Harness v{harness.version}</Pill>
      </div>

      <div className="mt-4 min-h-24">
        {harness.includePriorFailures && pastMistakes.length > 0 && (
          <div className="mb-3">
            <Label>Remembers your past mistakes</Label>
            <div className="flex flex-wrap gap-1.5">
              {pastMistakes.map((m) => (
                <Pill key={m} tone="bad">
                  {m}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {coaching ? (
          <Messages text={coaching.response} numbered={socratic} />
        ) : (
          <p className="rounded-xl border border-dashed border-hairline py-6 text-center text-sm text-muted">
            {loading ? "Thinking…" : "Submit your decision to get feedback."}
          </p>
        )}

        {coaching && submitted && (
          <p className="mt-3 text-sm text-muted">
            Coach&apos;s answer: <span className="font-medium text-ink">{ACTION_LABELS[coaching.action]}</span>
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-hairline pt-4">
        <Label>How the coach is set up for you</Label>
        <dl>
          {HARNESS_ROWS.map(({ field, value }) => (
            <div
              key={`${field}-${changeKey}`}
              className={`-mx-2 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                changedFields.has(field) ? "animate-glow" : ""
              }`}
            >
              <dt>{FIELD_LABELS[field]}</dt>
              <dd className={changedFields.has(field) ? "font-medium text-accent" : "text-muted"}>
                {formatValue(value(harness))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

// Questions become chat bubbles (numbered in Socratic mode); other lines are small notes.
function Messages({ text, numbered }: { text: string; numbered: boolean }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const questions = lines.filter((l) => l.trim().endsWith("?"));
  const bubbles = numbered ? questions : lines;
  const notes = numbered ? lines.filter((l) => !questions.includes(l)) : [];

  return (
    <div className="space-y-2">
      {bubbles.map((line, i) => (
        <div key={i} className="flex items-start gap-2.5">
          {numbered && <span className="mt-2.5 w-4 shrink-0 text-right text-xs font-semibold text-accent">{i + 1}</span>}
          <p className="rounded-2xl rounded-tl-md bg-canvas px-4 py-2.5 text-[15px] leading-snug">{line}</p>
        </div>
      ))}
      {notes.map((line, i) => (
        <p key={i} className="pt-1 text-xs leading-relaxed text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}
