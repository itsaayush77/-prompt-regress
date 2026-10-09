import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { MockProvider, OpenAICompatibleProvider, isDemoMode, makeProvider } from "../src/providers.ts";

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

test("openai-compatible provider retries a 500 then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 500, text: async () => "oops" };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "recovered" } }] }) };
  }) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  assert.equal((await p.complete("hi")).text, "recovered");
  assert.equal(calls, 2);
});

test("openai-compatible provider retries a 429 then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, text: async () => "slow down" };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "ok" } }] }) };
  }) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  assert.equal((await p.complete("hi")).text, "ok");
  assert.equal(calls, 2);
});

test("openai-compatible provider gives up after repeated 500s", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 500, text: async () => "still down" };
  }) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  await assert.rejects(() => p.complete("hi"), /provider 500/);
  assert.equal(calls, 3);
});

test("openai-compatible provider does not retry a 400", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 400, text: async () => "bad request" };
  }) as any;
  const p = new OpenAICompatibleProvider("m", "key", "http://x");
  await assert.rejects(() => p.complete("hi"), /provider 400/);
  assert.equal(calls, 1);
});

test("demo mode forces the mock provider and ignores API keys", async () => {
  process.env.DEMO_MODE = "true";
  process.env.OPENAI_API_KEY = "sk-real";
  try {
    assert.equal(isDemoMode(), true);
    const p = makeProvider("gpt-4o");
    assert.ok(p instanceof MockProvider);
  } finally {
    delete process.env.DEMO_MODE;
    delete process.env.OPENAI_API_KEY;
  }
  assert.equal(isDemoMode(), false);
});
test("openai-compatible provider times out a hanging request", async () => {
  process.env.PROMPT_REGRESS_TIMEOUT_MS = "50";
  globalThis.fetch = ((_url: any, init: any) =>
    new Promise((_res, rej) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        rej(e);
      });
    })) as any;
  try {
    const p = new OpenAICompatibleProvider("m", "key", "http://x");
    await assert.rejects(() => p.complete("hi"), /timeout after 50ms/);
  } finally {
    delete process.env.PROMPT_REGRESS_TIMEOUT_MS;
  }
});
