import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportStaticSite } from "../../src/export/static.js";
import { BenchmarkDb } from "../../src/storage/sqlite.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("static export", () => {
  it("writes index, methodology, latest, history, summary, and anomalies files", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    db.upsertVenueMarketStatus({ venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", reason: "not in symbol list" });
    exportStaticSite(db, join(tempDir, "public"));
    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("Perp Execution Quality");
    expect(index).toContain("7 Day History");
    expect(index).toContain("data/history-7d.json");
    expect(index).toContain("id=\"history\"");
    expect(readFileSync(join(tempDir, "public", "methodology.html"), "utf8")).toContain("100,000 USD");
    expect(readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8")).toContain("standx");
    expect(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8")).toContain("[]");
    db.close();
  });
});
