import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildDailySummaryText, generateDailySummaries } from "../../src/summary/daily.js";
import { BenchmarkDb } from "../../src/storage/sqlite.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("daily summary", () => {
  it("ranks venues by median 100k slippage and states not-listed markets", () => {
    const text = buildDailySummaryText("2026-05-28", "BTC", [
      { venue: "aster", market: "BTC", medianSlippageBp: 1.2, status: "listed" },
      { venue: "hyperliquid", market: "BTC", medianSlippageBp: 1.6, status: "listed" },
      { venue: "grvt", market: "BTC", medianSlippageBp: 3.3, status: "listed" },
      { venue: "standx", market: "BTC", medianSlippageBp: 4.2, status: "listed" }
    ]);
    expect(text).toContain("Yesterday BTC 100k taker execution: Aster best at 1.20 bp");
    expect(text).toContain("Hyperliquid +0.40 bp");
  });

  it("mentions StandX SOL as not listed", () => {
    const text = buildDailySummaryText("2026-05-28", "SOL", [
      { venue: "standx", market: "SOL", medianSlippageBp: null, status: "not_listed" }
    ]);
    expect(text).toContain("StandX SOL was not listed");
  });

  it("uses median slippage instead of average when aggregating SQLite rows", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-summary-"));
    const db = new BenchmarkDb(join(tempDir, "summary.sqlite"));
    db.initialize();
    const utcDate = "2026-05-28";
    const times = [
      Date.parse("2026-05-28T01:00:00.000Z"),
      Date.parse("2026-05-28T02:00:00.000Z"),
      Date.parse("2026-05-28T03:00:00.000Z")
    ];

    for (const [index, slippage] of [1, 100, 101].entries()) {
      const snapshotId = db.insertSnapshot({
        venue: "hyperliquid",
        market: "BTC",
        symbol: "BTC",
        source: "fixture",
        localTimestampMs: times[index],
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
        localTimestampMs: times[index],
        midPrice: 100,
        spreadBp: 1,
        depth10BpBidUsd: 1000,
        depth10BpAskUsd: 1000,
        depth10BpTotalUsd: 2000,
        buySlippage100kBp: slippage,
        sellSlippage100kBp: slippage,
        avgSlippage100kBp: slippage,
        insufficientDepth100k: false,
        buySlippage1mBp: slippage,
        sellSlippage1mBp: slippage,
        avgSlippage1mBp: slippage,
        insufficientDepth1m: false,
        valid: true,
        error: null
      });
    }

    const [btcSummary] = generateDailySummaries(db, utcDate);

    expect(btcSummary).toContain("Hyperliquid best at 100.00 bp");
    expect(btcSummary).not.toContain("67.33 bp");
    db.close();
  });
});
