import { runCollectionRound } from "../collector/run.js";
import { exportStaticSite } from "../export/static.js";
import { BenchmarkDb } from "../storage/sqlite.js";
import { shouldExportAfterRound } from "./schedule.js";

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parsePositiveNumber(name: string, fallback: string): number {
  const value = Number(optionValue(name, fallback));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

const dbPath = optionValue("--db", "data/benchmark.sqlite");
const outDir = optionValue("--out", "public");
const collectIntervalSeconds = parsePositiveNumber("--collect-interval", "60");
const exportIntervalSeconds = parsePositiveNumber("--export-interval", "300");
const once = process.argv.includes("--once");
let lastExportMs: number | null = null;

const db = new BenchmarkDb(dbPath);
db.initialize();

try {
  while (true) {
    const result = await runCollectionRound(db);
    const nowMs = Date.now();
    console.log(`collected=${result.collected} failed=${result.failed} not_listed=${result.notListed}`);

    if (shouldExportAfterRound({ lastExportMs, nowMs, exportIntervalSeconds })) {
      exportStaticSite(db, outDir);
      lastExportMs = nowMs;
      console.log(`exported static benchmark to ${outDir}`);
    }

    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, collectIntervalSeconds * 1000));
  }
} finally {
  db.close();
}
