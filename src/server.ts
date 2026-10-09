import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { compareRuns, runSuite } from "./runner.js";
import { getRun, listRuns, saveRun } from "./store.js";
import type { SuiteConfig } from "./types.js";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/runs", async (_req, res) => {
  const runs = await listRuns();
  res.json(runs.map(({ cases, ...rest }) => ({ ...rest, caseCount: cases.length })));
});

app.get("/api/runs/:id", async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  res.json(run);
});

app.post("/api/runs", async (req, res) => {
  try {
    const body = req.body as { suite?: SuiteConfig; yaml?: string };
    let suite: SuiteConfig;
    if (body.yaml) suite = yaml.load(body.yaml) as SuiteConfig;
    else if (body.suite) suite = body.suite;
    else return res.status(400).json({ error: "provide suite JSON or yaml string" });
    if (!suite?.tests?.length) return res.status(400).json({ error: "suite.tests must be non-empty" });
    const run = await runSuite({ temperature: 0, ...suite, model: suite.model || "mock" });
    await saveRun(run);
    res.status(201).json(run);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/compare", async (req, res) => {
  const { base, target } = req.query as { base?: string; target?: string };
  if (!base || !target) return res.status(400).json({ error: "need ?base=<id>&target=<id>" });
  const b = await getRun(base);
  const t = await getRun(target);
  if (!b || !t) return res.status(404).json({ error: "run not found" });
  res.json({ ...compareRuns(b, t), base: { id: b.id, name: b.name }, target: { id: t.id, name: t.name } });
});

const PORT = Number(process.env.PORT ?? 4000);
const __dir = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dir, "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
}
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`prompt-regress API on :${PORT}`));
}
