import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunRecord } from "./types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = process.env.DATA_FILE ?? join(root, "data", "runs.json");

// Public demo instances keep fewer runs.
function maxRuns(): number {
  return process.env.DEMO_MODE === "true" ? 20 : 50;
}

async function readAll(): Promise<RunRecord[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as RunRecord[];
  } catch {
    return [];
  }
}

async function writeAll(runs: RunRecord[]): Promise<void> {
  await fs.mkdir(dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(runs.slice(0, maxRuns()), null, 2));
}

export async function saveRun(run: RunRecord): Promise<RunRecord> {
  const runs = await readAll();
  runs.unshift(run);
  await writeAll(runs);
  return run;
}

export async function listRuns(): Promise<RunRecord[]> {
  return readAll();
}

export async function getRun(id: string): Promise<RunRecord | undefined> {
  return (await readAll()).find((r) => r.id === id);
}
