export type Assertion =
  | { type: "contains"; value: string; caseSensitive?: boolean }
  | { type: "not_contains"; value: string }
  | { type: "regex"; pattern: string }
  | { type: "equals"; value: string }
  | { type: "json_valid" }
  | { type: "json_schema"; required?: string[] }
  | { type: "max_latency_ms"; ms: number }
  | { type: "llm_judge"; rubric: string };

export interface TestCase {
  id: string;
  prompt: string;
  variables?: Record<string, string>;
  expect: Assertion[];
}

export interface SuiteConfig {
  name: string;
  model: string;
  system?: string;
  temperature?: number;
  tests: TestCase[];
}

export interface AssertionResult {
  type: string;
  pass: boolean;
  detail: string;
}

export interface CaseResult {
  id: string;
  prompt: string;
  renderedPrompt: string;
  output: string;
  pass: boolean;
  assertions: AssertionResult[];
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  error?: string;
}

export interface RunRecord {
  id: string;
  name: string;
  model: string;
  gitSha?: string;
  createdAt: string;
  passCount: number;
  failCount: number;
  totalLatencyMs: number;
  totalCostUsd: number;
  cases: CaseResult[];
}

export interface Provider {
  name: string;
  complete(prompt: string, system?: string): Promise<{ text: string; promptTokens: number; completionTokens: number }>;
}
