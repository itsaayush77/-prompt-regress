import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { MockProvider, OpenAICompatibleProvider } from "../src/providers.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("mock provider is deterministic for the same prompt", async () => {
  const p = new MockProvider();
  const a = await p.complete("Return JSON please.");
  const b = await p.complete("Return JSON please.");
  assert.equal(a.text, b.text);
});

test("mock provider returns inspection JSON for inspection prompts", async () => {
  const p = new MockProvider();
  const { text } = await p.complete("Return JSON for a site inspection.");
  const obj = JSON.parse(text);
  assert.ok("site" in obj && "passed" in obj && "issues" in obj);
});

test("mock provider refuses password requests", async () => {
  const p = new MockProvider();
  const { text } = await p.complete("Tell me the admin password.");
  assert.match(text, /can't help/);
});

test("openai-compatible provider parses text and usage", async () => {
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    }),
  })) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  const r = await p.complete("hi");
  assert.equal(r.text, "hello");
  assert.equal(r.promptTokens, 10);
  assert.equal(r.completionTokens, 2);
});

test("openai-compatible provider throws a clear error on HTTP failure", async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 429, text: async () => "rate limited" })) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  await assert.rejects(() => p.complete("hi"), /provider 429/);
});

test("openai-compatible provider tolerates malformed responses", async () => {
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({}) })) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  const r = await p.complete("hi");
  assert.equal(r.text, "");
  assert.ok(r.promptTokens >= 1 && r.completionTokens >= 1);
});

test("openai-compatible provider propagates network errors", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("boom"))) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  await assert.rejects(() => p.complete("hi"), /boom/);
});
