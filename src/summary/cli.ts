import { BenchmarkDb } from "../storage/sqlite.js";
import { generateDailySummaries } from "./daily.js";

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function yesterdayUtc(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const dbPath = optionValue("--db", "data/benchmark.sqlite");
const utcDate = optionValue("--date", yesterdayUtc());
const db = new BenchmarkDb(dbPath);
db.initialize();
const lines = generateDailySummaries(db, utcDate);
db.close();
for (const line of lines) console.log(line);
