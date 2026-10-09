import test, { before } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import type { RunRecord } from "../src/types.ts";

const dataFile = join(tmpdir(), `prompt-regress-test-${process.pid}.json`);

let saveRun: any, listRuns: any, getRun: any;
before(async () => {
  process.env.DATA_FILE = dataFile;
  ({ saveRun, listRuns, getRun } = await import("../src/store.ts"));
});

function fakeRun(id: string): RunRecord {
  return {
    id, name: "t", model: "mock", createdAt: new Date().toISOString(),
    passCount: 1, failCount: 0, totalLatencyMs: 1, totalCostUsd: 0, cases: [],
  };
}

test("store round-trips a saved run", async () => {
  await saveRun(fakeRun("a"));
  const all = await listRuns();
  assert.ok(all.some((r: RunRecord) => r.id === "a"));
  assert.equal((await getRun("a"))?.id, "a");
});

test("store keeps only the last 50 runs", async () => {
  for (let i = 0; i < 55; i++) await saveRun(fakeRun(`r${i}`));
  const all = await listRuns();
  assert.equal(all.length, 50);
  assert.equal(all[0].id, "r54");
});

test("store recovers from a missing file", async () => {
  await rm(dataFile, { force: true });
  assert.deepEqual(await listRuns(), []);
});

test("store recovers from corrupted JSON", async () => {
  await writeFile(dataFile, "{not json");
  assert.deepEqual(await listRuns(), []);
  await rm(dataFile, { force: true });
});

test("store caps at 20 runs in demo mode", async () => {
  process.env.DEMO_MODE = "true";
  try {
    for (let i = 0; i < 25; i++) await saveRun(fakeRun(`d${i}`));
    const all = await listRuns();
    assert.equal(all.length, 20);
    assert.equal(all[0].id, "d24");
  } finally {
    delete process.env.DEMO_MODE;
    await rm(dataFile, { force: true });
  }
});
