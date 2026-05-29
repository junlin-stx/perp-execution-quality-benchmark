import { runCollectionRound } from "../collector/run.js";
import { exportLatestData, exportStaticSite } from "../export/static.js";
import { BenchmarkDb } from "../storage/sqlite.js";
import { shouldRunScheduledTask } from "./schedule.js";

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
const latestExportIntervalSeconds = parsePositiveNumber("--latest-export-interval", String(collectIntervalSeconds));
const historyExportIntervalSeconds = parsePositiveNumber("--history-export-interval", optionValue("--export-interval", "300"));
const concurrency = parsePositiveNumber("--concurrency", "4");
const once = process.argv.includes("--once");
let lastLatestExportMs: number | null = null;
let lastHistoryExportMs: number | null = null;

const db = new BenchmarkDb(dbPath);
db.initialize();

try {
  while (true) {
    const result = await runCollectionRound(db, { concurrency });
    const nowMs = Date.now();
    console.log(`collected=${result.collected} failed=${result.failed} not_listed=${result.notListed}`);

    const shouldExportHistory = shouldRunScheduledTask({
      lastRunMs: lastHistoryExportMs,
      nowMs,
      intervalSeconds: historyExportIntervalSeconds
    });

    if (shouldExportHistory) {
      exportStaticSite(db, outDir);
      lastHistoryExportMs = nowMs;
      lastLatestExportMs = nowMs;
      console.log(`exported static benchmark to ${outDir}`);
    } else if (shouldRunScheduledTask({ lastRunMs: lastLatestExportMs, nowMs, intervalSeconds: latestExportIntervalSeconds })) {
      exportLatestData(db, outDir);
      lastLatestExportMs = nowMs;
      console.log(`exported latest data to ${outDir}`);
    }

    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, collectIntervalSeconds * 1000));
  }
} finally {
  db.close();
}
