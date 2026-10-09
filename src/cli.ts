#!/usr/bin/env node
import { promises as fs } from "node:fs";
import yaml from "js-yaml";
import { compareRuns, runSuite, type CompareSummary } from "./runner.js";
import { getRun, saveRun } from "./store.js";
import { compareTable, markdownReport } from "./report.js";
import type { RunRecord, SuiteConfig } from "./types.js";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.findIndex((a) => a === name || a.startsWith(name + "="));
  if (i === -1) return undefined;
  const a = args[i];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  return args[i + 1];
}

const HELP = `prompt-regress CLI

  --file <path>        suite file (YAML or JSON, default examples/tests.yaml)
  --model <name>       override the suite's model (default: suite model or mock)
  --fail-on-regress    exit 1 when any case fails
  --baseline <id|path> compare this run against a stored run ID, a saved
                       run-record JSON file, or a suite file (run as baseline)
  --report <format>    extra output; only "markdown" is supported
  --help               show this help

Exit codes: 0 pass · 1 regression detected · 2 config/usage error`;

function usageError(msg: string): never {
  console.error(`error: ${msg}\n\n${HELP}`);
  process.exit(2);
}

async function loadSuiteFile(file: string): Promise<SuiteConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    usageError(`cannot read file "${file}"`);
  }
  try {
    const parsed = (file.endsWith(".yaml") || file.endsWith(".yml") ? yaml.load(raw!) : JSON.parse(raw!)) as SuiteConfig;
    if (!parsed || !Array.isArray(parsed.tests) || parsed.tests.length === 0) {
      usageError(`"${file}" has no tests — suite.tests must be a non-empty array`);
    }
    return parsed;
  } catch (e: any) {
    if (e?.code === 2) throw e;
    usageError(`cannot parse "${file}": ${e?.message ?? e}`);
  }
  throw new Error("unreachable");
}

function isRunRecord(v: any): v is RunRecord {
  return !!v && typeof v === "object" && Array.isArray(v.cases) && typeof v.id === "string";
}

async function resolveBaseline(ref: string, modelOverride?: string): Promise<RunRecord> {
  const stored = await getRun(ref);
  if (stored) return stored;
  let raw: string;
  try {
    raw = await fs.readFile(ref, "utf8");
  } catch {
    usageError(`--baseline "${ref}" is neither a stored run ID nor a readable file`);
  }
  try {
    const parsed = (ref.endsWith(".yaml") || ref.endsWith(".yml") ? yaml.load(raw!) : JSON.parse(raw!)) as any;
    if (isRunRecord(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.tests) && parsed.tests.length > 0) {
      const run = await runSuite({ ...parsed, model: modelOverride ?? parsed.model ?? "mock" });
      await saveRun(run);
      console.log(`baseline run ${run.id}: ${run.passCount}/${run.cases.length} passed`);
      return run;
    }
  } catch (e: any) {
    if (e?.code === 2) throw e;
    usageError(`cannot parse --baseline "${ref}": ${e?.message ?? e}`);
  }
  usageError(`--baseline "${ref}" is not a run record or a suite file`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }
  if (args.includes("--report") && flag("--report") === undefined) {
    usageError("--report needs a format (markdown)");
  }

  const file = flag("--file") ?? "examples/tests.yaml";
  const modelOverride = flag("--model");
  const failOnRegress = args.includes("--fail-on-regress");
  const baselineRef = flag("--baseline");
  const reportFmt = flag("--report");
  if (reportFmt !== undefined && reportFmt !== "markdown") usageError(`unknown report format "${reportFmt}"`);

  const suite = await loadSuiteFile(file);
  const run = await runSuite({ ...suite, model: modelOverride ?? suite.model ?? "mock" });
  await saveRun(run);
  console.log(`Run ${run.id}: ${run.passCount}/${run.cases.length} passed | $${run.totalCostUsd.toFixed(5)} | ${run.totalLatencyMs}ms`);
  for (const c of run.cases.filter((c) => !c.pass)) {
    console.log(`FAIL ${c.id}: ${c.assertions.filter((a) => !a.pass).map((a) => a.detail).join("; ")}`);
  }

  let cmp: CompareSummary | undefined;
  if (baselineRef) {
    const baseline = await resolveBaseline(baselineRef, modelOverride);
    cmp = compareRuns(baseline, run);
    for (const l of compareTable(cmp)) console.log(l);
  }

  if (reportFmt === "markdown") console.log(markdownReport(run, cmp));

  const regressed =
    (failOnRegress && run.failCount > 0) ||
    (cmp !== undefined && cmp.flipped.some((f) => f.base && !f.target));
  if (regressed) process.exit(1);
}

main().catch((e) => {
  if (e?.code === 2) throw e; // usageError already exited
  console.error(e);
  process.exit(2);
});
