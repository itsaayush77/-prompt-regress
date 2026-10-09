#!/usr/bin/env node
import { promises as fs } from "node:fs";
import yaml from "js-yaml";
import { runSuite } from "./runner.js";
import { saveRun } from "./store.js";
import type { SuiteConfig } from "./types.js";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.findIndex((a) => a === name || a.startsWith(name + "="));
  if (i === -1) return undefined;
  const a = args[i];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  return args[i + 1];
}

async function main() {
  const file = flag("--file") ?? "examples/tests.yaml";
  const failOnRegress = args.includes("--fail-on-regress");
  const raw = await fs.readFile(file, "utf8");
  const suite = (file.endsWith(".yaml") || file.endsWith(".yml") ? yaml.load(raw) : JSON.parse(raw)) as SuiteConfig;
  const run = await runSuite({ ...suite, model: flag("--model") ?? suite.model ?? "mock" });
  await saveRun(run);
  console.log(`Run ${run.id}: ${run.passCount}/${run.cases.length} passed | $${run.totalCostUsd.toFixed(5)} | ${run.totalLatencyMs}ms`);
  for (const c of run.cases.filter((c) => !c.pass)) {
    console.log(`FAIL ${c.id}: ${c.assertions.filter((a) => !a.pass).map((a) => a.detail).join("; ")}`);
  }
  if (failOnRegress && run.failCount > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
