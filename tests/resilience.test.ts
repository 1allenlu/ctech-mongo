import assert from "node:assert/strict";
import { test } from "node:test";
import { withFallback, withServerSelectionTimeout, withTimeout } from "../lib/resilience.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("withTimeout returns fast results and rejects slow ones", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 50, "fast"), "ok");
  await assert.rejects(withTimeout(sleep(200), 20, "slow"), /slow timed out after 20ms/);
});

test("withFallback uses the fallback on timeout or error, and not otherwise", async () => {
  const fallback = async () => "fallback";
  assert.equal(await withFallback(async () => "primary", fallback, 50, "t"), "primary");
  assert.equal(await withFallback(() => sleep(200).then(() => "late"), fallback, 20, "t"), "fallback");
  assert.equal(await withFallback(() => Promise.reject(new Error("boom")), fallback, 50, "t"), "fallback");
});

test("withServerSelectionTimeout adds the option once and keeps existing values", () => {
  const uri = "mongodb+srv://user:pw@cluster0.example.net/?appName=Cluster0";
  assert.equal(new URL(withServerSelectionTimeout(uri, 5000)).searchParams.get("serverSelectionTimeoutMS"), "5000");
  assert.equal(new URL(withServerSelectionTimeout(uri, 5000)).searchParams.get("appName"), "Cluster0");
  const custom = "mongodb://localhost:27017/?serverSelectionTimeoutMS=100";
  assert.equal(withServerSelectionTimeout(custom, 5000), custom);
  assert.equal(new URL(withServerSelectionTimeout(uri + " ", 5000)).host, "cluster0.example.net");
});
