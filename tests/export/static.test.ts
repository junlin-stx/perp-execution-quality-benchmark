import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportStaticSite, exportLatestData, exportHistoryData } from "../../src/export/static.js";
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
    expect(index).toContain("const venues = [\"hyperliquid\", \"standx\", \"aster\", \"edgex\", \"grvt\", \"lighter\", \"extended\", \"nado\"]");
    expect(index).not.toContain("Binance Perps");
    expect(index).not.toContain("Aevo");
    expect(index).toContain("Aster");
    expect(index).toContain("edgeX");
    expect(index).toContain("validCount + \"/\" + venues.length + \" live</span>");
    expect(index).toContain("7 Day History");
    expect(index).toContain('dataUrl("history-7d.json")');
    expect(index).toContain("id=\"history\"");
    expect(index).toContain("Daily Summary");
    expect(index).toContain('dataUrl("daily-summary.json")');
    expect(index).toContain("id=\"daily-summary\"");
    const methodology = readFileSync(join(tempDir, "public", "methodology.html"), "utf8");
    expect(methodology).toContain("100,000 USD");
    expect(methodology).toContain("1,000,000 USD");
    expect(readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8")).toContain("standx");
    expect(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8")).toContain("[]");
    db.close();
  });

  it("does not export stale rows for removed venues", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    const raw = db.getRawDatabase();
    raw.prepare(`
      insert into orderbook_snapshots (
        id, venue, market, symbol, source, local_timestamp_ms, source_timestamp_ms, latency_ms,
        bid_count, ask_count, is_partial, status, error
      ) values (1, 'aevo', 'BTC', 'BTC-PERP', 'fixture', ?, null, 1, 1, 1, 0, 'ok', null)
    `).run(Date.now());
    raw.prepare(`
      insert into execution_metrics (
        snapshot_id, venue, market, symbol, local_timestamp_ms, mid_price, spread_bp,
        depth_10bp_bid_usd, depth_10bp_ask_usd, depth_10bp_total_usd,
        buy_slippage_100k_bp, sell_slippage_100k_bp, avg_slippage_100k_bp,
        insufficient_depth_100k, buy_slippage_1m_bp, sell_slippage_1m_bp, avg_slippage_1m_bp,
        insufficient_depth_1m, valid, error
      ) values (1, 'aevo', 'BTC', 'BTC-PERP', ?, 100, 1, 1000, 1000, 2000, 1, 1, 1, 0, 2, 2, 2, 0, 1, null)
    `).run(Date.now());
    exportStaticSite(db, join(tempDir, "public"));

    const latest = readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8");
    const history = readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8");
    expect(latest).not.toContain("aevo");
    expect(history).not.toContain("aevo");
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
    expect(index).toContain("\"1M Slippage\"");
    expect(index).toContain("td::before");
    expect(index).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 680px), 1fr))");
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

  it("exports 15 minute history rollups instead of raw metric rows", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    const baseMs = Date.parse("2026-05-29T08:00:00.000Z");
    for (const [index, spread] of [3, 1, 2].entries()) {
      const snapshotId = db.insertSnapshot({
        venue: "hyperliquid",
        market: "BTC",
        symbol: "BTC",
        source: "fixture",
        localTimestampMs: baseMs + index * 60_000,
        sourceTimestampMs: null,
        latencyMs: 1,
        bidCount: 1,
        askCount: 1,
        isPartial: false,
        status: "ok",
        error: null
      });
      db.insertMetrics(snapshotId, {
        venue: "hyperliquid",
        market: "BTC",
        symbol: "BTC",
        localTimestampMs: baseMs + index * 60_000,
        midPrice: 100,
        spreadBp: spread,
        depth10BpBidUsd: 1000 + spread,
        depth10BpAskUsd: 1000 + spread,
        depth10BpTotalUsd: 2000 + spread,
        buySlippage100kBp: spread,
        sellSlippage100kBp: spread,
        avgSlippage100kBp: spread,
        insufficientDepth100k: false,
        buySlippage1mBp: spread + 10,
        sellSlippage1mBp: spread + 10,
        avgSlippage1mBp: spread + 10,
        insufficientDepth1m: false,
        valid: true,
        error: null
      });
    }

    exportHistoryData(db, join(tempDir, "public"), { nowMs: baseMs + 10 * 60_000 });
    const history = JSON.parse(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8"));

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      venue: "hyperliquid",
      market: "BTC",
      sample_count: 3,
      spread_bp: 2,
      avg_slippage_100k_bp: 2,
      avg_slippage_1m_bp: 12
    });
    db.close();
  });

  it("lets latest data refresh without rewriting history data", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));
    const beforeHistory = readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8");

    exportLatestData(db, join(tempDir, "public"));

    expect(readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8")).toContain("generatedAt");
    expect(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8")).toBe(beforeHistory);
    db.close();
  });

  it("refreshes latest comparison data on the public page", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("setInterval(refreshLatest, 60_000)");
    expect(index).toContain("function refreshLatest()");
    db.close();
  });

  it("can render the public page to read data from an external base url", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"), { dataBaseUrl: "https://data.example.com/perp" });

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain('const dataBaseUrl = "https://data.example.com/perp";');
    expect(index).toContain('fetch(dataUrl("latest.json"))');
    db.close();
  });
});
