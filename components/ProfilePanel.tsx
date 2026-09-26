import type { UserProfile } from "@/shared/types";
import type { AppEvent } from "@/shared/ui-types";
import { SKILL_LABELS } from "@/lib/format";
import { Card } from "./ui";

const SKILLS = Object.keys(SKILL_LABELS) as (keyof UserProfile["skills"])[];

export default function ProfilePanel({ profile, events }: { profile: UserProfile; events: AppEvent[] }) {
  return (
    <>
      <Card title="Skills">
        <ul className="space-y-3.5">
          {SKILLS.map((skill) => {
            const score = Math.max(0, Math.min(100, profile.skills[skill]));
            const mistakes = profile.failures[skill];
            return (
              <li key={skill}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{SKILL_LABELS[skill]}</span>
                  <span className={mistakes > 0 ? "font-medium text-bad" : "text-muted"}>
                    {mistakes === 0 ? "No mistakes" : `${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}`}
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
                    className={`h-full rounded-full transition-all duration-700 ${mistakes > 0 ? "bg-bad" : "bg-accent"}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

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
    </>
  );
}

function dotColor(e: AppEvent) {
  if (e.failure) return "bg-bad";
  if (e.text.startsWith("Harness")) return "bg-accent";
  if (e.text.startsWith("Case")) return "bg-good";
  return "bg-gray-300";
}
