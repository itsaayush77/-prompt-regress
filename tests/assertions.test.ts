import test from "node:test";
import assert from "node:assert/strict";
import { checkAssertions } from "../src/assertions.ts";

test("contains passes when output includes the value", () => {
  const [r] = checkAssertions("status: passed today", [{ type: "contains", value: "passed" }], 5);
  assert.equal(r.pass, true);
});

test("contains fails with a helpful detail when missing", () => {
  const [r] = checkAssertions("hello world", [{ type: "contains", value: "passed" }], 5);
  assert.equal(r.pass, false);
  assert.match(r.detail, /missing/);
});

test("contains is case-insensitive by default", () => {
  const [r] = checkAssertions("STATUS PASSED", [{ type: "contains", value: "passed" }], 5);
  assert.equal(r.pass, true);
});

test("contains respects caseSensitive: true", () => {
  const [r] = checkAssertions("STATUS PASSED", [{ type: "contains", value: "passed", caseSensitive: true }], 5);
  assert.equal(r.pass, false);
});

test("not_contains passes when value is absent", () => {
  const [r] = checkAssertions("all clear", [{ type: "not_contains", value: "password" }], 5);
  assert.equal(r.pass, true);
});

test("not_contains fails when value leaks into output", () => {
  const [r] = checkAssertions("the password is 123", [{ type: "not_contains", value: "password" }], 5);
  assert.equal(r.pass, false);
});

test("regex passes on match", () => {
  const [r] = checkAssertions('{"result": "ok"}', [{ type: "regex", pattern: '"result"\\s*:\\s*"ok"' }], 5);
  assert.equal(r.pass, true);
});

test("regex fails on no match", () => {
  const [r] = checkAssertions('{"result": "bad"}', [{ type: "regex", pattern: '"result"\\s*:\\s*"ok"' }], 5);
  assert.equal(r.pass, false);
});

test("regex with an invalid pattern fails closed with detail", () => {
  const [r] = checkAssertions("anything", [{ type: "regex", pattern: "([unclosed" }], 5);
  assert.equal(r.pass, false);
  assert.match(r.detail, /bad pattern/);
});

test("equals passes ignoring surrounding whitespace", () => {
  const [r] = checkAssertions("  ok\n", [{ type: "equals", value: "ok" }], 5);
  assert.equal(r.pass, true);
});

test("equals fails on different content", () => {
  const [r] = checkAssertions("ok-ish", [{ type: "equals", value: "ok" }], 5);
  assert.equal(r.pass, false);
});

test("json_valid passes including fenced code blocks", () => {
  const [r] = checkAssertions('```json\n{"a": 1}\n```', [{ type: "json_valid" }], 5);
  assert.equal(r.pass, true);
});

test("json_valid fails on malformed JSON", () => {
  const [r] = checkAssertions('{"a": }', [{ type: "json_valid" }], 5);
  assert.equal(r.pass, false);
});

test("json_schema passes when all required keys present", () => {
  const [r] = checkAssertions('{"site":"A","passed":true,"issues":[]}', [
    { type: "json_schema", required: ["site", "passed", "issues"] },
  ], 5);
  assert.equal(r.pass, true);
});

test("json_schema fails listing the missing keys", () => {
  const [r] = checkAssertions('{"site":"A"}', [
    { type: "json_schema", required: ["site", "passed", "issues"] },
  ], 5);
  assert.equal(r.pass, false);
  assert.match(r.detail, /passed/);
  assert.match(r.detail, /issues/);
});

test("json_schema fails when output is not JSON at all", () => {
  const [r] = checkAssertions("just words", [{ type: "json_schema", required: ["a"] }], 5);
  assert.equal(r.pass, false);
});

test("max_latency_ms passes under budget", () => {
  const [r] = checkAssertions("x", [{ type: "max_latency_ms", ms: 100 }], 42);
  assert.equal(r.pass, true);
});

test("max_latency_ms passes exactly at the limit", () => {
  const [r] = checkAssertions("x", [{ type: "max_latency_ms", ms: 100 }], 100);
  assert.equal(r.pass, true);
});

test("max_latency_ms fails over budget", () => {
  const [r] = checkAssertions("x", [{ type: "max_latency_ms", ms: 100 }], 101);
  assert.equal(r.pass, false);
});

test("empty output fails content assertions", () => {
  const [r] = checkAssertions("", [{ type: "contains", value: "anything" }], 5);
  assert.equal(r.pass, false);
});
