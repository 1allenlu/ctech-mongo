import "dotenv/config";
import { MongoClient } from "mongodb";

let connection: Promise<MongoClient> | undefined;

// Reuse the client's pool. Keep driver defaults until actual concurrency is known.
export function getClient(): Promise<MongoClient> {
  if (!connection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required on the server.");
    const client = new MongoClient(uri);
    connection = client.connect().catch(async (error: unknown) => {
      connection = undefined;
      await client.close();
      throw error;
    });
  }
  return connection;
}

export async function closeConnection(): Promise<void> {
  const pending = connection;
  connection = undefined;
  if (pending) await (await pending).close();
}

export function databaseName(): string {
  return process.env.MONGODB_DB || "hackathon";
}
