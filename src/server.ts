import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { compareRuns, runSuite } from "./runner.js";
import { getRun, listRuns, saveRun } from "./store.js";
import { parseSuite } from "./suiteSchema.js";
import { isDemoMode } from "./providers.js";
import type { SuiteConfig } from "./types.js";

export const app = express();
app.use(cors());
// Tighter body cap on public demo instances.
app.use(express.json({ limit: isDemoMode() ? "100kb" : "1mb" }));

/** Tiny in-memory sliding-window limiter (per IP). No dependency needed. */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ error: "rate limited, try again shortly" });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

const runLimiter = createRateLimiter({
  windowMs: 60_000,
  // Stricter on public demo instances.
  max: Number(process.env.RATE_LIMIT_PER_MIN ?? (isDemoMode() ? 30 : 60)),
});

app.get("/api/health", (_req, res) => res.json({ ok: true, demo: isDemoMode() }));

app.get("/api/runs", async (_req, res) => {
  const runs = await listRuns();
  res.json(runs.map(({ cases, ...rest }) => ({ ...rest, caseCount: cases.length })));
});

app.get("/api/runs/:id", async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  res.json(run);
});

app.post("/api/runs", runLimiter, async (req, res) => {
  try {
    const body = req.body as { suite?: SuiteConfig; yaml?: string };
    const raw = body.yaml ? yaml.load(body.yaml) : body.suite;
    if (raw === undefined) return res.status(400).json({ error: "provide suite JSON or yaml string" });
    let suite: SuiteConfig;
    try {
      suite = parseSuite(raw);
    } catch (e: any) {
      return res.status(400).json({ error: String(e?.message ?? e) });
    }
    const run = await runSuite({ temperature: 0, ...suite });
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
  app.listen(PORT, () => {
    console.log(`prompt-regress API on :${PORT}${isDemoMode() ? " (DEMO MODE: mock provider only)" : ""}`);
  });
}
