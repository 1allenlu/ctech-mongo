import { readFileSync } from "node:fs";
import { closeConnection, databaseName } from "../db/connection.js";
import { getHarnessVersions } from "../db/helpers.js";
import type { HarnessConfig } from "../shared/type.js";

type Options = { userId?: string; from?: number; to?: number; help?: boolean };
function parseArgs(args: string[]): Options {
  const options: Options = {};
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Repeated option: ${flag}`);
    seen.add(flag);
    if (flag === "--help") { options.help = true; continue; }
    if (!["--user", "--from", "--to"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--user") options.userId = value;
    else {
      const version = Number(value);
      if (!Number.isSafeInteger(version) || version < 1) throw new Error("Versions must be positive integers.");
      options[flag === "--from" ? "from" : "to"] = version;
    }
  }
  if ((options.from === undefined) !== (options.to === undefined)) throw new Error("Provide both --from and --to, or neither.");
  if (options.from !== undefined && options.to! <= options.from) throw new Error("--to must be greater than --from.");
  return options;
}

function readLatestDemo(): { userId?: string; simulation?: string; database?: string } {
  try {
    const report = JSON.parse(readFileSync(new URL("../docs/live-demo-result.json", import.meta.url), "utf8"));
    return report.status === "passed" && typeof report.userId === "string" ? report : {};
  } catch { return {}; }
}

function showComparison(before: HarnessConfig, after: HarnessConfig): void {
  const fields = [
    {
      field: "coachingMode", old: before.coachingMode, new: after.coachingMode,
      meaning: after.coachingMode === "socratic"
        ? "Coaching should guide the reviewer with questions instead of direct explanations."
        : "Coaching should explain requirements directly instead of primarily asking questions.",
    },
    {
      field: "includePriorFailures", old: before.includePriorFailures, new: after.includePriorFailures,
      meaning: after.includePriorFailures
        ? "The agent may receive this reviewer's relevant prior mistakes as context."
        : "Prior mistakes should be excluded from the agent's context.",
    },
    {
      field: "tools.documentationChecker", old: before.tools.documentationChecker, new: after.tools.documentationChecker,
      meaning: after.tools.documentationChecker
        ? "The agent may use the documentation-checking tool to identify missing required documents."
        : "The documentation-checking tool should be unavailable to the agent.",
    },
    {
      field: "tools.policyLookup", old: before.tools.policyLookup, new: after.tools.policyLookup,
      meaning: after.tools.policyLookup
        ? "The agent may retrieve the relevant fictional policy."
        : "The policy-lookup tool should be unavailable to the agent.",
    },
  ];
  const changed = fields.filter(f => f.old !== f.new);
  const unchanged = fields.filter(f => f.old === f.new);
  console.log(`\nHarness v${before.version} -> v${after.version}`);
  console.log(`${changed.length} behavior settings changed. Version numbers label snapshots; they are not a behavior change themselves.`);
  if (changed.length) {
    console.table(changed.map(f => ({ setting: f.field, before: String(f.old), after: String(f.new) })));
    console.log("What evolved:");
    changed.forEach(f => console.log(`- ${f.field}: ${f.meaning}`));
  } else console.log("The behavior settings are identical in these two versions.");
  if (unchanged.length) {
    console.log("\nUnchanged settings:");
    unchanged.forEach(f => console.log(`- ${f.field}: ${String(f.new)}`));
  }
  if (before.coachingMode !== after.coachingMode) {
    const examples = {
      direct: "This policy requires a signed referral and a treatment summary. Check whether both are in the packet.",
      socratic: "Which documents does this policy require, and which ones can you verify in the packet?",
    };
    console.log("\nIllustrative coaching wording (not generated or recorded agent responses):");
    console.log(`v${before.version}: "${examples[before.coachingMode]}"`);
    console.log(`v${after.version}: "${examples[after.coachingMode]}"`);
  }
  console.log("\nBoth versions follow the agreed rule: explain requirements before submission; reveal the answer afterward.");
  console.log("This compares stored configuration. The agent must implement these settings; a diff alone does not prove that coaching behavior ran or explain why a version was created.");
}

let stage = "arguments";
try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("npm run harness:diff -- [--user USER_ID] [--from VERSION --to VERSION]");
    console.log("Default: reviewer from the latest successful local demo report, comparing the two latest stored versions. Read-only.");
  } else {
    const report = readLatestDemo();
    const userId = options.userId ?? report.userId;
    if (!userId) throw new Error("No successful local demo report. Specify --user USER_ID.");
    if (!options.userId && report.database !== databaseName()) throw new Error("Demo report targets a different database. Set the intended MONGODB_DB or specify --user explicitly.");
    console.log(`READ-ONLY harness comparison\nDatabase: ${databaseName()}\nReviewer: ${userId}`);
    stage = "database";
    const history = await getHarnessVersions(userId);
    stage = "comparison";
    if (!history.length) throw new Error("No harness versions found for this reviewer.");
    console.log(`Available versions: ${history.map(h => `v${h.version}`).join(", ")}`);
    if (new Set(history.map(h => h.version)).size !== history.length) throw new Error("Duplicate version numbers found for this reviewer. Resolve them before comparing.");
    if (options.from === undefined && history.length < 2) {
      console.log("Only one harness version exists. There is no saved evolution to compare yet.");
    } else {
      const before = options.from === undefined ? history.at(-2)! : history.find(h => h.version === options.from);
      const after = options.to === undefined ? history.at(-1)! : history.find(h => h.version === options.to);
      if (!before || !after) throw new Error("Requested versions do not exist. Choose from the available versions above.");
      showComparison(before, after);
    }
    if (report.userId === userId && report.database === databaseName() && report.simulation) console.log(`\nLatest demo provenance: ${report.simulation}`);
    console.log("\nNo Atlas data was changed.");
  }
} catch (error) {
  console.error(stage === "database"
    ? "Could not read harness history. Check MONGODB_URI, database access, and your network."
    : error instanceof Error ? error.message : "Comparison failed.");
  process.exitCode = 1;
} finally {
  await closeConnection();
}
