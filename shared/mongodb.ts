import { loadEnvFile } from "node:process";
import { MongoClient, type Db } from "mongodb";

// Reuse the URI and database used by test_db.py. Existing environment wins.
try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

let connection: Promise<MongoClient> | undefined;

export async function getDb(): Promise<Db> {
  if (!connection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required");
    const client = new MongoClient(uri);
    connection = client.connect().catch(async (error: unknown) => {
      connection = undefined;
      await client.close();
      throw error;
    });
  }
  return (await connection).db(process.env.MONGODB_DB ?? "hackathon");
}

// Call at application shutdown, not after each operation.
export async function closeMongoDB(): Promise<void> {
  const pending = connection;
  connection = undefined;
  if (pending) await (await pending).close();
}
