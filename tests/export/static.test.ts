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
  it("writes index, methodology, latest, health, history, summary, and anomalies files", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    db.upsertVenueMarketStatus({ venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", reason: "not in symbol list" });
    exportStaticSite(db, join(tempDir, "public"));
    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("Perp Execution Quality");
    expect(index).toContain("const venues = [\"hyperliquid\", \"standx\", \"aster\", \"edgex\", \"grvt\", \"lighter\", \"extended\", \"nado\"]");
    expect(index).toContain("const benchmarkVenues = [\"standx\",\"edgex\",\"grvt\",\"lighter\",\"extended\",\"nado\"]");
    expect(index).toContain("const referenceVenues = [\"hyperliquid\",\"aster\"]");
    expect(index).not.toContain("Binance Perps");
    expect(index).not.toContain("Aevo");
    expect(index).toContain("Aster");
    expect(index).toContain("edgeX");
    expect(index).toContain("validCount + \"/\" + benchmarkVenues.length + \" benchmark live</span>");
    expect(index).toContain("Venue / Market Drilldown");
    expect(index).toContain('fetchJson("history-7d.json", suffix)');
    expect(index).toContain("id=\"history\"");
    expect(index).toContain("Daily Summary");
    expect(index).toContain('fetchJson("daily-summary.json", suffix)');
    expect(index).toContain("id=\"daily-summary\"");
    expect(index).toContain("Data Health");
    expect(index).toContain('fetchJson("health.json", suffix)');
    expect(index).toContain("function renderHealth(health)");
    expect(index).toContain("latest sample age");
    expect(index).toContain("per venue/market status");
    expect(index).toContain("Public Anomaly Feed");
    expect(index).toContain('fetchJson("anomalies.json", suffix)');
    expect(index).toContain("function renderAnomalies(anomalies)");
    expect(index).toContain("dedupe_key");
    const methodology = readFileSync(join(tempDir, "public", "methodology.html"), "utf8");
    expect(methodology).toContain("3bp, 5bp, and 10bp Depth");
    expect(methodology).toContain("Spread is a top-of-book signal and can be affected by venue tick size or public-book aggregation");
    expect(methodology).toContain("depth_total_usd = depth_bid_usd + depth_ask_usd");
    expect(methodology).toContain("JSON and SQLite keep bid, ask, and total fields");
    expect(methodology).toContain("100,000 USD");
    expect(methodology).toContain("1,000,000 USD");
    expect(readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8")).toContain("standx");
    expect(readFileSync(join(tempDir, "public", "data", "health.json"), "utf8")).toContain("expectedTargetCount");
    expect(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8")).toContain("[]");
    db.close();
  });

  it("exports public data health from latest target and snapshot states", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    const nowMs = Date.parse("2026-06-08T08:00:00.000Z");
    const okSnapshot = db.insertSnapshot({
      venue: "standx",
      market: "BTC",
      symbol: "BTC-USD",
      source: "fixture",
      localTimestampMs: nowMs - 30_000,
      sourceTimestampMs: null,
      latencyMs: 1,
      bidCount: 1,
      askCount: 1,
      isPartial: false,
      status: "ok",
      error: null
    });
    db.insertMetrics(okSnapshot, {
      venue: "standx",
      market: "BTC",
      symbol: "BTC-USD",
      localTimestampMs: nowMs - 30_000,
      midPrice: 100,
      spreadBp: 1,
      depth3BpBidUsd: 300,
      depth3BpAskUsd: 300,
      depth3BpTotalUsd: 600,
      depth5BpBidUsd: 500,
      depth5BpAskUsd: 500,
      depth5BpTotalUsd: 1000,
      depth10BpBidUsd: 1000,
      depth10BpAskUsd: 1000,
      depth10BpTotalUsd: 2000,
      buySlippage100kBp: 2,
      sellSlippage100kBp: 2,
      avgSlippage100kBp: 2,
      insufficientDepth100k: false,
      buySlippage1mBp: null,
      sellSlippage1mBp: null,
      avgSlippage1mBp: null,
      insufficientDepth1m: true,
      valid: true,
      error: null
    });
    db.insertSnapshot({
      venue: "standx",
      market: "SOL",
      symbol: "SOL-USD",
      source: "fixture",
      localTimestampMs: nowMs - 20_000,
      sourceTimestampMs: null,
      latencyMs: 0,
      bidCount: 0,
      askCount: 0,
      isPartial: false,
      status: "not_listed",
      error: "not_listed"
    });
    db.insertSnapshot({
      venue: "grvt",
      market: "BTC",
      symbol: "BTC-USDT",
      source: "fixture",
      localTimestampMs: nowMs - 10_000,
      sourceTimestampMs: null,
      latencyMs: 0,
      bidCount: 0,
      askCount: 0,
      isPartial: false,
      status: "failed",
      error: "timeout"
    });

    exportStaticSite(db, join(tempDir, "public"), { nowMs });
    const health = JSON.parse(readFileSync(join(tempDir, "public", "data", "health.json"), "utf8"));

    expect(health).toMatchObject({
      schemaVersion: 2,
      expectedTargetCount: 24,
      expectedListedCount: 23,
      validSampleCount: 1,
      failedCount: 1,
      notListedCount: 1,
      insufficientDepthCount: 1,
      latestSampleTimestampMs: nowMs - 10_000,
      latestSampleAgeSeconds: 10
    });
    expect(health.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ venue: "standx", market: "BTC", status: "insufficient_depth", latest_sample_age_seconds: 30 }),
      expect.objectContaining({ venue: "standx", market: "SOL", status: "not_listed", latest_sample_age_seconds: 20 }),
      expect.objectContaining({ venue: "grvt", market: "BTC", status: "failed", reason: "timeout", latest_sample_age_seconds: 10 })
    ]));
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
        depth_3bp_bid_usd, depth_3bp_ask_usd, depth_3bp_total_usd,
        depth_5bp_bid_usd, depth_5bp_ask_usd, depth_5bp_total_usd,
        depth_10bp_bid_usd, depth_10bp_ask_usd, depth_10bp_total_usd,
        buy_slippage_100k_bp, sell_slippage_100k_bp, avg_slippage_100k_bp,
        insufficient_depth_100k, buy_slippage_1m_bp, sell_slippage_1m_bp, avg_slippage_1m_bp,
        insufficient_depth_1m, valid, error
      ) values (1, 'aevo', 'BTC', 'BTC-PERP', ?, 100, 1, 300, 300, 600, 500, 500, 1000, 1000, 1000, 2000, 1, 1, 1, 0, 2, 2, 2, 0, 1, null)
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
    expect(index).toContain("Reference");
    expect(index).toContain("vs best");
    expect(index).toContain("depthRatio");
    expect(index).toContain("\"3bp Depth\"");
    expect(index).toContain("\"5bp Depth\"");
    expect(index).toContain("<th>Venue</th><th>Status</th><th>10bp Depth</th><th>5bp Depth</th><th>3bp Depth</th><th>100k Slippage</th><th>1M Slippage</th><th>Spread</th>");
    expect(index.indexOf('metricCell(item, "depth_10bp_total_usd"')).toBeLessThan(index.indexOf("spreadCell(item)"));
    expect(index).toContain("Tick-size sensitive");
    expect(index).not.toContain('metricCell(item, "spread_bp"');
    expect(index).toContain("benchmarkRows");
    expect(index).toContain("Reference only");
    expect(index).toContain("N/A: not listed");
    expect(index).not.toContain("<tbody id=\"grid\"></tbody>");
    db.close();
  });

  it("sorts market tables by 10bp depth while keeping reference venues separate", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("const benchmarkRows = sortRowsByDepth(rows.filter((item) => !item.reference))");
    expect(index).toContain("const referenceRows = sortRowsByDepth(rows.filter((item) => item.reference))");
    expect(index).toContain("const sortedRows = benchmarkRows.concat(referenceRows)");
    expect(index).toContain("function sortRowsByDepth(rows)");
    expect(index).toContain('metricValue(right, "depth_10bp_total_usd")');
    db.close();
  });

  it("renders comparison panels in a single column with responsive metric labels", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("data-label='\" + label + \"'");
    expect(index).toContain("\"100k Slippage\"");
    expect(index).toContain("\"1M Slippage\"");
    expect(index).toContain("td::before");
    expect(index).toContain(".comparison-grid { display: grid; grid-template-columns: 1fr;");
    expect(index).not.toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 680px), 1fr))");
    db.close();
  });

  it("shows SOL on the public page so not-listed states are visible", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    const latest = readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8");
    expect(index).toContain("const visibleMarkets = [\"BTC\", \"ETH\", \"SOL\"]");
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
        depth3BpBidUsd: 300 + spread,
        depth3BpAskUsd: 300 + spread,
        depth3BpTotalUsd: 600 + spread,
        depth5BpBidUsd: 500 + spread,
        depth5BpAskUsd: 500 + spread,
        depth5BpTotalUsd: 1000 + spread,
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
      depth_3bp_total_usd: 602,
      depth_5bp_total_usd: 1002,
      depth_10bp_total_usd: 2002,
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

  it("refreshes public page data every minute", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("setInterval(refreshData, 60_000)");
    expect(index).toContain("function refreshData()");
    expect(index).toContain("let refreshInFlight = false");
    expect(index).toContain("if (refreshInFlight) return");
    expect(index).toContain("const ts = Date.now()");
    expect(index).toContain("loadData(ts)");
    expect(index).toContain("renderData(latest, history, summaries, health, anomalies)");
    expect(index).toContain("refreshInFlight = false");
    expect(index).toContain('fetchJson("latest.json", suffix)');
    expect(index).toContain('fetchJson("history-7d.json", suffix)');
    expect(index).toContain('fetchJson("daily-summary.json", suffix)');
    expect(index).toContain('fetchJson("health.json", suffix)');
    expect(index).toContain('fetchJson("anomalies.json", suffix)');
    expect(index).toContain("if (!response.ok) throw new Error");
    db.close();
  });

  it("renders venue and market drilldown from 7 day history", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"));

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain("Venue / Market Drilldown");
    expect(index).toContain("function renderDrilldown(history, health)");
    expect(index).toContain("selectedPair");
    expect(index).toContain("drilldown-select");
    expect(index).toContain("missing samples");
    expect(index).toContain("insufficient-depth samples");
    expect(index).toContain("Median 10bp depth");
    expect(index).toContain("Median 100k slippage");
    db.close();
  });

  it("can render the public page to read data from an external base url", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    exportStaticSite(db, join(tempDir, "public"), { dataBaseUrl: "https://data.example.com/perp" });

    const index = readFileSync(join(tempDir, "public", "index.html"), "utf8");
    expect(index).toContain('const dataBaseUrl = "https://data.example.com/perp";');
    expect(index).toContain("fetch(dataUrl(name) + suffix)");
    db.close();
  });
});
