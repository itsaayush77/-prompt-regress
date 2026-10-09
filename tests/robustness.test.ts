import test, { before } from "node:test";
import assert from "node:assert/strict";
import { runSuite } from "../src/runner.ts";

let createRateLimiter: any;
before(async () => {
  // server.ts only listens when NODE_ENV != "test"; set it before importing.
  process.env.NODE_ENV = "test";
  ({ createRateLimiter } = await import("../src/server.ts"));
});

test("concurrency preserves case order and results", async () => {
  const suite = {
    name: "t", model: "mock",
    tests: [0, 1, 2, 3, 4, 5].map((i) => ({
      id: `c${i}`, prompt: "Return JSON please.", expect: [{ type: "json_valid" } as const],
    })),
  };
  const serial = await runSuite(suite);
  const parallel = await runSuite(suite, { concurrency: 3 });
  assert.deepEqual(parallel.cases.map((c) => c.id), serial.cases.map((c) => c.id));
  assert.equal(parallel.passCount, serial.passCount);
});

test("rate limiter allows up to max then returns 429", () => {
  const limit = createRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { ip: "1.2.3.4" };
  let status = 0;
  const res = { status: (s: number) => { status = s; return { json: () => {} }; } };
  let next = 0;
  limit(req as any, res as any, () => next++);
  limit(req as any, res as any, () => next++);
  assert.equal(next, 2);
  limit(req as any, res as any, () => next++);
  assert.equal(next, 2);
  assert.equal(status, 429);
});
