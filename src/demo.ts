#!/usr/bin/env node
// 60-second regression demo: runs examples/baseline.yaml, then
// examples/regressed.yaml (same case IDs, friendlier prompts), saves both
// runs, prints the comparison table, and exits 1 when a regression is caught.
import { promises as fs } from "node:fs";
import yaml from "js-yaml";
import { compareRuns, runSuite } from "./runner.js";
import { saveRun } from "./store.js";
import type { SuiteConfig } from "./types.js";

async function loadSuite(file: string): Promise<SuiteConfig> {
  const raw = await fs.readFile(file, "utf8");
  return yaml.load(raw) as SuiteConfig;
}

function line(c: string[], w: number[]): string {
  return c.map((v, i) => v.padEnd(w[i])).join(" | ");
}

async function main() {
  const base = await runSuite(await loadSuite("examples/baseline.yaml"));
  await saveRun(base);
  console.log(`baseline : ${base.passCount}/${base.cases.length} passed | $${base.totalCostUsd.toFixed(5)} | ${base.totalLatencyMs}ms`);

  const target = await runSuite(await loadSuite("examples/regressed.yaml"));
  await saveRun(target);
  console.log(`regressed: ${target.passCount}/${target.cases.length} passed | $${target.totalCostUsd.toFixed(5)} | ${target.totalLatencyMs}ms`);

  const cmp = compareRuns(base, target);
  console.log(`\ndelta: pass ${cmp.passDelta >= 0 ? "+" : ""}${cmp.passDelta} | cost $${cmp.costDelta.toFixed(5)} | latency ${cmp.latencyDelta}ms`);

  const toFail = cmp.flipped.filter((f) => f.base && !f.target);
  if (cmp.flipped.length === 0) {
    console.log("no flips — prompts behave identically.");
  } else {
    console.log("\nflipped cases:");
    const widths = [Math.max(7, ...cmp.flipped.map((f) => f.id.length)), 12, 12];
    console.log(line(["case", "baseline", "regressed"], widths));
    for (const f of cmp.flipped) {
      console.log(line([f.id, String(f.base), String(f.target)], widths));
    }
  }

  if (toFail.length > 0) {
    console.log(`\nREGRESSION CAUGHT: ${toFail.length} case(s) flipped pass -> fail.`);
    process.exit(1);
  }
  console.log("\nno pass -> fail regression.");
}

main().catch((e) => { console.error(e); process.exit(2); });
