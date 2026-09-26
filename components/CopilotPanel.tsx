import type { AgentResponse, HarnessConfig } from "@/shared/types";
import { ACTION_LABELS } from "@/lib/format";
import { Badge, Card } from "./ui";

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
      right={<Badge tone={harness.version > 1 ? "violet" : "slate"}>Coaching with Harness v{harness.version}</Badge>}
      className="h-fit"
    >
      <p className="mb-3 text-sm text-slate-600">
        Mode: <span className="font-semibold text-slate-800">{socratic ? "Socratic (asks guiding questions)" : "Direct (tells you the answer)"}</span>
      </p>

      {harness.includePriorFailures && recentMistakes.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">Your recent mistakes</p>
          <div className="flex flex-wrap gap-2">
            {recentMistakes.map((m, i) => (
              <Badge key={i} tone="rose">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {coaching ? (
        socratic ? (
          <SocraticCoaching text={coaching.response} />
        ) : (
          <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4 text-base leading-relaxed text-slate-800">
            {lines(coaching.response).map((line, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {line}
              </p>
            ))}
          </div>
        )
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-slate-500">
          {loading ? "Copilot is thinking…" : "Make your decision. The copilot gives feedback after you submit."}
        </p>
      )}

      {coaching && submitted && (
        <p className="mt-4 text-sm text-slate-600">
          Copilot&apos;s call: <span className="font-semibold text-slate-800">{ACTION_LABELS[coaching.action]}</span>
        </p>
      )}
    </Card>
  );
}

// Questions become numbered bubbles; other lines (notes, checklist) stay as text.
function SocraticCoaching({ text }: { text: string }) {
  let n = 0;
  return (
    <ol className="space-y-3">
      {lines(text).map((line, i) =>
        line.trim().endsWith("?") ? (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
              {++n}
            </span>
            <span className="rounded-2xl rounded-tl-sm bg-violet-50 px-4 py-2 text-base text-slate-800">{line}</span>
          </li>
        ) : (
          <li key={i} className="text-sm text-slate-600">
            {line}
          </li>
        ),
      )}
    </ol>
  );
}

function lines(text: string) {
  return text.split("\n").filter((l) => l.trim());
}
