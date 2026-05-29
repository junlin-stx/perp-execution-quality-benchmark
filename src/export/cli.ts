import { BenchmarkDb } from "../storage/sqlite.js";
import { exportStaticSite } from "./static.js";

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const dbPath = optionValue("--db", "data/benchmark.sqlite");
const outDir = optionValue("--out", "public");
const dataBaseUrl = optionValue("--data-base-url", process.env.PUBLIC_DATA_BASE_URL ?? "");

const db = new BenchmarkDb(dbPath);
db.initialize();
exportStaticSite(db, outDir, { dataBaseUrl });
db.close();
console.log(`exported static benchmark to ${outDir}`);
