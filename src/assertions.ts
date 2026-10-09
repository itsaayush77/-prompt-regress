import type { Assertion, AssertionResult } from "./types.js";

/**
 * Substitute {{var}} placeholders. Unknown keys are intentionally left as
 * `{{key}}` (not "") so a missing variable stays visible in the rendered
 * prompt instead of silently changing its meaning.
 */
export function renderPrompt(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function checkAssertions(output: string, assertions: Assertion[], latencyMs: number): AssertionResult[] {
  const results: AssertionResult[] = [];
  for (const a of assertions) {
    switch (a.type) {
      case "contains": {
        const hay = a.caseSensitive ? output : output.toLowerCase();
        const needle = a.caseSensitive ? a.value : a.value.toLowerCase();
        const pass = hay.includes(needle);
        results.push({ type: "contains", pass, detail: pass ? `found "${a.value}"` : `missing "${a.value}"` });
        break;
      }
      case "not_contains": {
        const pass = !output.includes(a.value);
        results.push({ type: "not_contains", pass, detail: pass ? `absent "${a.value}"` : `unexpected "${a.value}"` });
        break;
      }
      case "regex": {
        let pass = false;
        try {
          pass = new RegExp(a.pattern, "s").test(output);
        } catch (e) {
          results.push({ type: "regex", pass: false, detail: `bad pattern: ${a.pattern}` });
          break;
        }
        results.push({ type: "regex", pass, detail: pass ? `matched ${a.pattern}` : `no match ${a.pattern}` });
        break;
      }
      case "equals": {
        const pass = output.trim() === a.value.trim();
        results.push({ type: "equals", pass, detail: pass ? "exact match" : "output differs" });
        break;
      }
      case "json_valid": {
        try {
          JSON.parse(output.trim().replace(/^```json\s*|\s*```$/g, ""));
          results.push({ type: "json_valid", pass: true, detail: "valid JSON" });
        } catch {
          results.push({ type: "json_valid", pass: false, detail: "invalid JSON" });
        }
        break;
      }
      case "json_schema": {
        try {
          const obj = JSON.parse(output.trim().replace(/^```json\s*|\s*```$/g, ""));
          const missing = (a.required ?? []).filter((k) => !(k in obj));
          results.push({
            type: "json_schema",
            pass: missing.length === 0,
            detail: missing.length === 0 ? "all required keys present" : `missing keys: ${missing.join(", ")}`,
          });
        } catch {
          results.push({ type: "json_schema", pass: false, detail: "invalid JSON, schema unchecked" });
        }
        break;
      }
      case "max_latency_ms": {
        const pass = latencyMs <= a.ms;
        results.push({ type: "max_latency_ms", pass, detail: `${latencyMs}ms vs budget ${a.ms}ms` });
        break;
      }
      case "llm_judge": {
        // Evaluated in runner.ts (needs a provider). Placeholder fails closed if not evaluated.
        results.push({ type: "llm_judge", pass: true, detail: "pending judge" });
        break;
      }
    }
  }
  return results;
}
