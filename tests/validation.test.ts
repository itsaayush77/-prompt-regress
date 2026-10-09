import test from "node:test";
import assert from "node:assert/strict";
import { parseSuite } from "../src/suiteSchema.ts";

const valid = {
  name: "s",
  model: "mock",
  tests: [{ id: "a", prompt: "hi", expect: [{ type: "contains", value: "hi" }] }],
};

test("valid suite parses", () => {
  assert.equal(parseSuite(valid).name, "s");
});

test("model defaults to mock when absent", () => {
  const { model, ...rest } = valid;
  assert.equal(parseSuite(rest).model, "mock");
});

test("empty tests array is rejected with a clear path", () => {
  assert.throws(() => parseSuite({ name: "s", tests: [] }), /suite\.tests/);
});

test("unknown assertion type is rejected", () => {
  const bad = { ...valid, tests: [{ id: "a", prompt: "hi", expect: [{ type: "nope" }] }] };
  assert.throws(() => parseSuite(bad), /invalid suite/);
});

test("missing suite name is rejected", () => {
  const { name, ...rest } = valid as any;
  assert.throws(() => parseSuite(rest), /name/);
});
