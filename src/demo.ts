#!/usr/bin/env node
// 60-second regression demo: runs examples/baseline.yaml, then
// examples/regressed.yaml (same case IDs, friendlier prompts), saves both
// runs, prints the comparison table, and exits 1 when a regression is caught.
import { promises as fs } from "node:fs";
import yaml from "js-yaml";
import { compareRuns, runSuite } from "./runner.js";
import { saveRun } from "./store.js";
import { compareTable } from "./report.js";
import type { SuiteConfig } from "./types.js";

async function loadSuite(file: string): Promise<SuiteConfig> {
  const raw = await fs.readFile(file, "utf8");
  return yaml.load(raw) as SuiteConfig;
}

async function main() {
  const base = await runSuite(await loadSuite("examples/baseline.yaml"));
  await saveRun(base);
  console.log(`baseline : ${base.passCount}/${base.cases.length} passed | $${base.totalCostUsd.toFixed(5)} | ${base.totalLatencyMs}ms`);

  const target = await runSuite(await loadSuite("examples/regressed.yaml"));
  await saveRun(target);
  console.log(`regressed: ${target.passCount}/${target.cases.length} passed | $${target.totalCostUsd.toFixed(5)} | ${target.totalLatencyMs}ms`);

  const cmp = compareRuns(base, target);
  for (const l of compareTable(cmp)) console.log(l);

  const toFail = cmp.flipped.filter((f) => f.base && !f.target);
  if (toFail.length > 0) {
    console.log(`\nREGRESSION CAUGHT: ${toFail.length} case(s) flipped pass -> fail.`);
    process.exit(1);
  }
  console.log("\nno pass -> fail regression.");
}

main().catch((e) => { console.error(e); process.exit(2); });
