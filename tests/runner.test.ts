import test from "node:test";
import assert from "node:assert/strict";
import { checkAssertions, renderPrompt } from "../src/assertions.ts";
import { compareRuns, runSuite } from "../src/runner.ts";

test("renderPrompt substitutes variables", () => {
  assert.equal(renderPrompt("hi {{name}}", { name: "A" }), "hi A");
});

test("contains / regex / json assertions", () => {
  const out = JSON.stringify({ result: "ok" });
  const r = checkAssertions(out, [
    { type: "contains", value: "result" },
    { type: "regex", pattern: "\"result\"\\s*:\\s*\"ok\"" },
    { type: "json_valid" },
    { type: "json_schema", required: ["result"] },
  ], 10);
  assert.ok(r.every((x) => x.pass));
});

test("failing assertion reported", () => {
  const r = checkAssertions("hello", [{ type: "contains", value: "passed" }], 5);
  assert.equal(r[0].pass, false);
});

test("mock suite runs offline and records cost/latency", async () => {
  const run = await runSuite({
    name: "t", model: "mock",
    tests: [{ id: "a", prompt: "Return JSON please.", expect: [{ type: "json_valid" }] }],
  });
  assert.equal(run.cases.length, 1);
  assert.ok(run.totalLatencyMs >= 0);
  assert.ok(run.totalCostUsd >= 0);
});

test("compare detects flips", async () => {
  const base = await runSuite({ name: "b", model: "mock", tests: [{ id: "a", prompt: "x", expect: [] }] });
  const target = { ...base, id: "t2", passCount: 0, failCount: 1, cases: [{ ...base.cases[0], pass: !base.cases[0].pass }] };
  const c = compareRuns(base, target as any);
  assert.equal(c.flipped.length, 1);
});
