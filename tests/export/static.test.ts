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
    expect(index).toContain("const venues = [\"hyperliquid\", \"binance_perps\", \"aevo\", \"standx\", \"aster\", \"edgex\"]");
    expect(index).toContain("Aster");
    expect(index).toContain("edgeX");
    expect(index).toContain("validCount + \"/\" + venues.length + \" live</span>");
    expect(index).toContain("7 Day History");
    expect(index).toContain("data/history-7d.json");
    expect(index).toContain("id=\"history\"");
    expect(index).toContain("Daily Summary");
    expect(index).toContain("data/daily-summary.json");
    expect(index).toContain("id=\"daily-summary\"");
    expect(readFileSync(join(tempDir, "public", "methodology.html"), "utf8")).toContain("100,000 USD");
    expect(readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8")).toContain("standx");
    expect(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8")).toContain("[]");
    db.close();
  });

  it("renders latest metrics as market comparison panels with best and delta cues", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    db.upsertVenueMarketStatus({ venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", reason: "not in symbol list" });
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("id=\"comparison\"");
    expect(index).toContain("market-panel");
    expect(index).toContain("Best");
    expect(index).toContain("vs best");
    expect(index).toContain("depthRatio");
    expect(index).toContain("N/A: not listed");
    expect(index).not.toContain("<tbody id=\"grid\"></tbody>");
    db.close();
  });

  it("includes responsive metric labels so narrow screens do not hide comparison columns", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("data-label='\" + label + \"'");
    expect(index).toContain("\"100k Slippage\"");
    expect(index).toContain("td::before");
    expect(index).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr))");
    db.close();
  });

  it("temporarily hides SOL from the public page while keeping SOL data exported", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    const latest = readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8");
    expect(index).toContain("const visibleMarkets = [\"BTC\", \"ETH\"]");
    expect(index).toContain("markets.filter((market) => visibleMarkets.includes(market))");
    expect(latest).toContain("\"market\": \"SOL\"");
    db.close();
  });
});
