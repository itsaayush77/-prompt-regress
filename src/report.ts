import type { RunRecord } from "./types.js";
import type { CompareSummary } from "./runner.js";

export function formatUsd(n: number): string {
  return `$${n.toFixed(5)}`;
}

function padCells(cells: string[], widths: number[]): string {
  return cells.map((v, i) => v.padEnd(widths[i])).join(" | ");
}

/** Human-readable comparison lines (shared by the CLI and the demo script). */
export function compareTable(cmp: CompareSummary): string[] {
  const lines = [
    `delta: pass ${cmp.passDelta >= 0 ? "+" : ""}${cmp.passDelta} | cost ${formatUsd(cmp.costDelta)} | latency ${cmp.latencyDelta}ms`,
  ];
  if (cmp.flipped.length === 0) {
    lines.push("no flips — prompts behave identically.");
    return lines;
  }
  lines.push("", "flipped cases:");
  const widths = [Math.max(4, ...cmp.flipped.map((f) => f.id.length)), 8, 8];
  lines.push(padCells(["case", "baseline", "target"], widths));
  for (const f of cmp.flipped) {
    lines.push(padCells([f.id, String(f.base), String(f.target)], widths));
  }
  return lines;
}

/** Markdown report for terminals and $GITHUB_STEP_SUMMARY. */
export function markdownReport(run: RunRecord, cmp?: CompareSummary): string {
  const out: string[] = [];
  out.push(`## prompt-regress report`, "");
  out.push(`Run \`${run.id}\` — **${run.name}** (\`${run.model}\`)`, "");
  out.push(`| passed | failed | cost | latency |`);
  out.push(`|---|---|---|---|`);
  out.push(`| ${run.passCount}/${run.cases.length} | ${run.failCount} | ${formatUsd(run.totalCostUsd)} | ${run.totalLatencyMs}ms |`, "");
  out.push(`| case | result | latency | cost |`);
  out.push(`|---|---|---|---|`);
  for (const c of run.cases) {
    const failing = c.assertions.filter((a) => !a.pass).map((a) => a.detail).join("; ");
    out.push(`| \`${c.id}\` | ${c.pass ? "PASS" : `FAIL — ${failing}`} | ${c.latencyMs}ms | ${formatUsd(c.costUsd)} |`);
  }
  if (cmp) {
    out.push("", `### vs baseline (\`${cmp.baseId}\`)`, "");
    out.push(`pass Δ ${cmp.passDelta}, cost Δ ${formatUsd(cmp.costDelta)}, latency Δ ${cmp.latencyDelta}ms`, "");
    if (cmp.flipped.length > 0) {
      out.push(`| case | baseline | target |`, `|---|---|---|`);
      for (const f of cmp.flipped) out.push(`| \`${f.id}\` | ${f.base} | ${f.target} |`);
    } else {
      out.push(`No flipped cases.`);
    }
  }
  return out.join("\n");
}
