import test from "node:test";
import assert from "node:assert/strict";
import { compareRuns, runSuite } from "../src/runner.ts";
import type { RunRecord } from "../src/types.ts";

function runWith(pass: boolean, cost: number, latency: number): RunRecord {
  return {
    id: `id-${Math.random()}`, name: "t", model: "mock", createdAt: new Date().toISOString(),
    passCount: pass ? 1 : 0, failCount: pass ? 0 : 1,
    totalLatencyMs: latency, totalCostUsd: cost,
    cases: [{
      id: "a", prompt: "x", renderedPrompt: "x", output: "y", pass,
      assertions: [], latencyMs: latency, promptTokens: 1, completionTokens: 1,
      costUsd: cost, model: "mock",
    }],
  };
}

test("compare reports pass, cost and latency deltas", () => {
  const c = compareRuns(runWith(true, 0.001, 10), runWith(false, 0.003, 30));
  assert.equal(c.passDelta, -1);
  assert.ok(Math.abs(c.costDelta - 0.002) < 1e-9);
  assert.equal(c.latencyDelta, 20);
});

test("compare lists flips both directions", () => {
  const base = runWith(true, 0, 0);
  const target = runWith(false, 0, 0);
  assert.deepEqual(compareRuns(base, target).flipped, [{ id: "a", base: true, target: false }]);
  assert.deepEqual(compareRuns(target, base).flipped, [{ id: "a", base: false, target: true }]);
});

test("compare is empty when nothing changed", () => {
  const c = compareRuns(runWith(true, 0.001, 10), runWith(true, 0.001, 10));
  assert.equal(c.passDelta, 0);
  assert.deepEqual(c.flipped, []);
});

test("runner records a provider error as a failed case, not a crash", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (() => Promise.reject(new Error("net down"))) as any;
  try {
    const run = await runSuite({
      name: "t", model: "some-model",
      tests: [{ id: "a", prompt: "hi", expect: [{ type: "contains", value: "x" }] }],
    });
    assert.equal(run.cases.length, 1);
    assert.equal(run.cases[0].pass, false);
    assert.match(run.cases[0].assertions[0].detail, /net down/);
  } finally {
    delete process.env.OPENAI_API_KEY;
    // @ts-expect-error restore fetch to the runtime default
    delete globalThis.fetch;
  }
});
