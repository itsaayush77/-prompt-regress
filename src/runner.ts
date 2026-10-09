import { checkAssertions, renderPrompt } from "./assertions.js";
import { estimateCost } from "./providers.js";
import type { CaseResult, RunRecord, SuiteConfig } from "./types.js";
import { makeProvider } from "./providers.js";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function judgeWithLLM(output: string, rubric: string, judgeModel = "mock"): Promise<{ pass: boolean; detail: string }> {
  const judge = makeProvider(judgeModel);
  const { text } = await judge.complete(
    `Rubric: ${rubric}\n\nCandidate output:\n${output}\n\nReply with exactly PASS or FAIL plus one-line reason.`,
  );
  const pass = /pass/i.test(text);
  return { pass, detail: `judge(${judgeModel}): ${text.slice(0, 200)}` };
}

export async function runSuite(suite: SuiteConfig, opts: { judgeModel?: string } = {}): Promise<RunRecord> {
  const provider = makeProvider(suite.model);
  const cases: CaseResult[] = [];

  for (const t of suite.tests) {
    const rendered = renderPrompt(t.prompt, t.variables);
    const start = Date.now();
    try {
      const { text, promptTokens, completionTokens } = await provider.complete(rendered, suite.system);
      const latencyMs = Date.now() - start;
      let assertions = checkAssertions(text, t.expect.filter((e) => e.type !== "llm_judge"), latencyMs);

      for (const e of t.expect.filter((e) => e.type === "llm_judge")) {
        if (e.type === "llm_judge") {
          const j = await judgeWithLLM(text, e.rubric, opts.judgeModel ?? suite.model);
          assertions.push({ type: "llm_judge", pass: j.pass, detail: j.detail });
        }
      }

      const pass = assertions.every((a) => a.pass);
      cases.push({
        id: t.id, prompt: t.prompt, renderedPrompt: rendered, output: text, pass,
        assertions, latencyMs, promptTokens, completionTokens,
        costUsd: estimateCost(suite.model, promptTokens, completionTokens), model: suite.model,
      });
    } catch (err: any) {
      cases.push({
        id: t.id, prompt: t.prompt, renderedPrompt: rendered, output: "",
        pass: false, assertions: [{ type: "error", pass: false, detail: String(err?.message ?? err) }],
        latencyMs: Date.now() - start, promptTokens: 0, completionTokens: 0,
        costUsd: 0, model: suite.model, error: String(err?.message ?? err),
      });
    }
  }

  const passCount = cases.filter((c) => c.pass).length;
  return {
    id: uid(),
    name: suite.name,
    model: suite.model,
    gitSha: process.env.GITHUB_SHA?.slice(0, 7),
    createdAt: new Date().toISOString(),
    passCount,
    failCount: cases.length - passCount,
    totalLatencyMs: cases.reduce((s, c) => s + c.latencyMs, 0),
    totalCostUsd: cases.reduce((s, c) => s + c.costUsd, 0),
    cases,
  };
}

export interface CompareSummary {
  baseId: string;
  targetId: string;
  passDelta: number;
  costDelta: number;
  latencyDelta: number;
  flipped: { id: string; base: boolean; target: boolean }[];
}

export function compareRuns(base: RunRecord, target: RunRecord): CompareSummary {
  const b = new Map(base.cases.map((c) => [c.id, c]));
  const flipped: CompareSummary["flipped"] = [];
  for (const c of target.cases) {
    const prev = b.get(c.id);
    if (prev && prev.pass !== c.pass) flipped.push({ id: c.id, base: prev.pass, target: c.pass });
  }
  return {
    baseId: base.id, targetId: target.id,
    passDelta: target.passCount - base.passCount,
    costDelta: target.totalCostUsd - base.totalCostUsd,
    latencyDelta: target.totalLatencyMs - base.totalLatencyMs,
    flipped,
  };
}
