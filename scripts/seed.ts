import { closeConnection, databaseName, getClient } from "../db/connection.js";
import { applySeed, loadSeed, planSeed } from "../seed/seed.js";

try {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply")) throw new Error("Usage: npm run seed -- [--apply]");
  const apply = args.includes("--apply");
  const data = loadSeed();
  const client = await getClient();
  const db = client.db(databaseName());
  console.log(`${apply ? "APPLY" : "READ-ONLY PREVIEW"}: database ${db.databaseName}`);
  const plan = apply ? await applySeed(db, client, data) : await planSeed(db, data);
  console.table(plan.map(p => ({ collection: p.collection, identity: JSON.stringify(p.key), action: p.action, reason: p.reason })));
  console.log(JSON.stringify({ insert: plan.filter(p => p.action === "insert").length, preserve: plan.filter(p => p.action === "preserve").length, conflict: plan.filter(p => p.action === "conflict").length }));
  if (plan.some(p => p.action === "conflict")) process.exitCode = 1;
  if (!apply) console.log("No writes performed. Use npm run seed -- --apply only when ready to insert missing documents.");
} catch (error) {
  // Avoid dumping connection details from driver errors into shared terminal output.
  console.error(`Seed failed (${error instanceof Error ? error.name : "unknown error"}). Check the target, connection, JSON files, and preview conflicts. No existing data is overwritten.`);
  process.exitCode = 1;
} finally {
  await closeConnection();
}
