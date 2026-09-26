import type { UserProfile } from "@/shared/types";
import type { AppEvent } from "@/shared/ui-types";
import { SKILL_LABELS } from "@/lib/format";
import { Card } from "./ui";

const SKILLS = Object.keys(SKILL_LABELS) as (keyof UserProfile["skills"])[];

export default function ProfilePanel({ profile, events }: { profile: UserProfile; events: AppEvent[] }) {
  return (
    <>
      <Card title="Reviewer profile">
        <ul className="space-y-3">
          {SKILLS.map((skill) => {
            const score = Math.max(0, Math.min(100, profile.skills[skill]));
            const failures = profile.failures[skill];
            return (
              <li key={skill}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-800">{SKILL_LABELS[skill]}</span>
                  <span className={failures > 0 ? "font-semibold text-rose-700" : "text-slate-500"}>
                    {failures} {failures === 1 ? "failure" : "failures"}
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-slate-100"
                  role="meter"
                  aria-label={`${SKILL_LABELS[skill]} skill`}
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${score < 40 ? "bg-rose-500" : "bg-indigo-500"}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Event log">
        <ol className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {[...events].reverse().map((e, i) => (
            <li key={`${e.ts}-${i}`} className="flex gap-3">
              <time className="shrink-0 font-mono text-xs text-slate-400">{new Date(e.ts).toLocaleTimeString()}</time>
              <span className={e.text.startsWith("Harness") ? "font-semibold text-violet-700" : "text-slate-800"}>{e.text}</span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
