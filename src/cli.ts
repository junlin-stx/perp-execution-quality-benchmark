import { runCollector } from "./collector/run.js";

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const once = process.argv.includes("--once");
const dbPath = optionValue("--db", "data/benchmark.sqlite");
const intervalSeconds = Number(optionValue("--interval", "60"));

if (!Number.isFinite(intervalSeconds) || intervalSeconds < 30) {
  throw new Error("--interval must be at least 30 seconds");
}

await runCollector({ dbPath, once, intervalSeconds });
