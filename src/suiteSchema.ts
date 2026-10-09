import { z } from "zod";

const assertionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("contains"), value: z.string(), caseSensitive: z.boolean().optional() }),
  z.object({ type: z.literal("not_contains"), value: z.string() }),
  z.object({ type: z.literal("regex"), pattern: z.string() }),
  z.object({ type: z.literal("equals"), value: z.string() }),
  z.object({ type: z.literal("json_valid") }),
  z.object({ type: z.literal("json_schema"), required: z.array(z.string()).optional() }),
  z.object({ type: z.literal("max_latency_ms"), ms: z.number().positive() }),
  z.object({ type: z.literal("llm_judge"), rubric: z.string().min(1) }),
]);

export const suiteSchema = z.object({
  name: z.string().min(1, "suite.name must be a non-empty string"),
  model: z.string().min(1).default("mock"),
  system: z.string().optional(),
  temperature: z.number().optional(),
  tests: z
    .array(
      z.object({
        id: z.string().min(1, "each test needs an id"),
        prompt: z.string(),
        variables: z.record(z.string(), z.string()).optional(),
        expect: z.array(assertionSchema),
      }),
    )
    .min(1, "suite.tests must be a non-empty array"),
});

/** Validate unknown input; throws a single readable Error listing every issue path. */
export function parseSuite(input: unknown): import("./types.js").SuiteConfig {
  const result = suiteSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`invalid suite: ${details}`);
  }
  return result.data;
}
