import type { UserProfile } from "@/shared/types";
import type { AppEvent } from "@/shared/ui-types";
import { SKILL_LABELS } from "@/lib/format";
import { Card } from "./ui";

const SKILLS = Object.keys(SKILL_LABELS) as (keyof UserProfile["skills"])[];

export function SkillsCard({ profile }: { profile: UserProfile }) {
  return (
    <Card title="Skills">
      <ul className="space-y-3.5">
        {SKILLS.map((skill) => {
          // `skills` counts correct answers, `failures` incorrect ones.
          const correct = profile.skills[skill];
          const mistakes = profile.failures[skill];
          const attempts = correct + mistakes;
          const score = attempts ? Math.round((correct / attempts) * 100) : 0;
          return (
            <li key={skill}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span>{SKILL_LABELS[skill]}</span>
                <span className={mistakes > 0 ? "font-medium text-bad" : "text-muted"}>
                  {attempts === 0 ? "Not practiced yet" : `${correct} of ${attempts} correct`}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-canvas"
                role="meter"
                aria-label={`${SKILL_LABELS[skill]} skill`}
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-700 ${score < 50 ? "bg-bad" : "bg-good"}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ActivityCard({ events }: { events: AppEvent[] }) {
  return (
    <Card title="Activity">
      <ol className="max-h-56 space-y-2.5 overflow-y-auto">
        {[...events].reverse().map((e, i) => (
          <li key={`${e.ts}-${i}`} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dotColor(e)}`} />
            <span className="flex-1">{e.text}</span>
            <time className="text-xs text-muted">
              {new Date(e.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </time>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function dotColor(e: AppEvent) {
  if (e.kind === "harness") return "bg-accent";
  if (e.kind === "case") return e.failure ? "bg-bad" : "bg-good";
  return "bg-gray-300";
}
