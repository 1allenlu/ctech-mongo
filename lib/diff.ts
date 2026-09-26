import type { HarnessConfig } from "@/shared/types";
import type { HarnessDiffItem } from "@/shared/ui-types";

// Flattens nested fields to dotted paths, e.g. "tools.documentationChecker".
// `version` is left out: the UI shows it separately as "v1 → v2".
export function diffHarness(a: HarnessConfig, b: HarnessConfig): HarnessDiffItem[] {
  const from = flatten(a);
  const to = flatten(b);
  const fields = new Set([...Object.keys(from), ...Object.keys(to)]);
  fields.delete("version");

  return [...fields]
    .filter((field) => from[field] !== to[field])
    .map((field) => ({ field, from: from[field], to: to[field] }));
}

function flatten(obj: object, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}
