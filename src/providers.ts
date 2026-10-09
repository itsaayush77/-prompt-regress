import type { Provider } from "./types.js";

const PRICES_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "gpt-4o": { in: 0.005, out: 0.015 },
  default: { in: 0.0002, out: 0.0008 },
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICES_PER_1K[model] ?? PRICES_PER_1K.default;
  return (promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out;
}

export function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Deterministic mock provider — no API key needed. Output depends only on
 *  prompt content (same prompt always yields the same text):
 *  - prompts asking for JSON return canned JSON,
 *  - prompts asking for a conversational / plain-English summary return
 *    chatty prose with NO JSON (this is what makes examples/regressed.yaml
 *    fail its JSON assertions — a realistic prompt regression),
 *  - sensitive requests are refused, everything else is echoed. */
export class MockProvider implements Provider {
  name = "mock";
  async complete(prompt: string) {
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 20));
    void t0;
    const lower = prompt.toLowerCase();
    let text: string;
    if (lower.includes("conversationally") || lower.includes("plain english") || lower.includes("plain-english")) {
      text = "Here's a quick summary: the Site-A inspection passed with no issues. Let me know if you need anything else!";
    } else if (lower.includes("json") && lower.includes("inspection")) {
      text = JSON.stringify({ site: "Site-A", passed: true, issues: [], inspector: "mock" }, null, 2);
    } else if (lower.includes("json")) {
      text = JSON.stringify({ result: "ok", echo: prompt.slice(0, 80) }, null, 2);
    } else if (lower.includes("refuse") || lower.includes("password")) {
      text = "I can't help with that request.";
    } else {
      text = `Mock response for: ${prompt.slice(0, 160)}`;
    }
    return { text, promptTokens: approxTokens(prompt), completionTokens: approxTokens(text) };
  }
}

/** OpenAI-compatible HTTP provider (works with OpenAI, OpenRouter, Ollama, LM Studio).
 *  Timeout comes from PROMPT_REGRESS_TIMEOUT_MS (default 30000). Retries up to
 *  2 times with backoff on network errors and 429/5xx; other 4xx fail fast. */
export class OpenAICompatibleProvider implements Provider {
  name: string;
  private timeoutMs: number;
  constructor(
    private model: string,
    private apiKey: string,
    private baseUrl = "https://api.openai.com/v1",
  ) {
    this.name = model;
    this.timeoutMs = Number(process.env.PROMPT_REGRESS_TIMEOUT_MS ?? 30000);
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
  async complete(prompt: string, system?: string) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify({
            model: this.model,
            messages: [
              ...(system ? [{ role: "system", content: system }] : []),
              { role: "user", content: prompt },
            ],
            temperature: 0,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const retryable = res.status === 429 || res.status >= 500;
          const body = await res.text();
          lastError = new Error(`provider ${res.status}: ${body}`);
          if (retryable && attempt < 2) {
            await this.sleep(300 * 2 ** attempt);
            continue;
          }
          throw lastError;
        }
        const data = (await res.json()) as any;
        const text: string = data.choices?.[0]?.message?.content ?? "";
        const promptTokens: number = data.usage?.prompt_tokens ?? approxTokens(prompt);
        const completionTokens: number = data.usage?.completion_tokens ?? approxTokens(text);
        return { text, promptTokens, completionTokens };
      } catch (e: any) {
        if (e?.name === "AbortError") throw new Error(`provider timeout after ${this.timeoutMs}ms`);
        if (e?.message?.startsWith("provider ")) throw e;
        lastError = e;
        if (attempt < 2) {
          await this.sleep(300 * 2 ** attempt);
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
}

export function makeProvider(model: string): Provider {
  const key = process.env.OPENAI_API_KEY ?? "";
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  if (model === "mock" || !key) return new MockProvider();
  return new OpenAICompatibleProvider(model, key, base);
}
