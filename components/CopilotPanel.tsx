import type { AgentResponse, HarnessConfig } from "@/shared/types";
import { ACTION_LABELS } from "@/lib/format";
import { Card, Pill } from "./ui";

export default function CopilotPanel({
  harness,
  coaching,
  loading,
  submitted,
  recentMistakes,
}: {
  harness: HarnessConfig;
  coaching: AgentResponse | null;
  loading: boolean;
  submitted: boolean;
  recentMistakes: string[];
}) {
  const socratic = harness.coachingMode === "socratic";

  return (
    <Card
      title="Copilot"
      right={<Pill tone={harness.version > 1 ? "accent" : "neutral"}>Harness v{harness.version}</Pill>}
      className="h-fit lg:sticky lg:top-[4.5rem]"
    >
      <p className="-mt-2 mb-4 text-sm text-muted">{socratic ? "Asks guiding questions" : "Gives direct answers"}</p>

      {harness.includePriorFailures && recentMistakes.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Past mistakes</p>
          <div className="flex flex-wrap gap-1.5">
            {recentMistakes.map((m) => (
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
        <p className="py-6 text-center text-sm text-muted">
          {loading ? "Thinking…" : "Submit your decision to get feedback."}
        </p>
      )}

      {coaching && submitted && (
        <p className="mt-4 border-t border-hairline pt-3 text-sm text-muted">
          Copilot&apos;s answer: <span className="font-medium text-ink">{ACTION_LABELS[coaching.action]}</span>
        </p>
      )}
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
