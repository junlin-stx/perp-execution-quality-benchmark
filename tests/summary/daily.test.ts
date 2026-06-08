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
  it("ranks benchmark venues by median 100k slippage and states not-listed markets", () => {
    const text = buildDailySummaryText("2026-05-28", "BTC", [
      { venue: "aster", market: "BTC", medianSlippageBp: 1.2, status: "listed" },
      { venue: "hyperliquid", market: "BTC", medianSlippageBp: 1.6, status: "listed" },
      { venue: "grvt", market: "BTC", medianSlippageBp: 3.3, status: "listed" },
      { venue: "standx", market: "BTC", medianSlippageBp: 4.2, status: "listed" }
    ]);
    expect(text).toContain("2026-05-28 BTC execution-quality note: GRVT led benchmark venues at 3.30 bp median 100k taker slippage");
    expect(text).toContain("StandX was +0.90 bp vs GRVT");
    expect(text).toContain("Reference only: Aster 1.20 bp, Hyperliquid 1.60 bp.");
    expect(text).not.toContain("Aster best");
    expect(text).not.toContain("Hyperliquid +");
  });

  it("mentions StandX SOL as not listed", () => {
    const text = buildDailySummaryText("2026-05-28", "SOL", [
      { venue: "standx", market: "SOL", medianSlippageBp: null, status: "not_listed" }
    ]);
    expect(text).toContain("StandX SOL was not listed");
  });

  it("writes a copyable daily market note with reference and insufficient-depth caveats", () => {
    const text = buildDailySummaryText("2026-05-28", "ETH", [
      { venue: "hyperliquid", market: "ETH", medianSlippageBp: 1.4, status: "listed" },
      { venue: "standx", market: "ETH", medianSlippageBp: 2.1, status: "listed" },
      { venue: "grvt", market: "ETH", medianSlippageBp: null, status: "insufficient_depth" },
      { venue: "nado", market: "ETH", medianSlippageBp: 4.4, status: "listed" }
    ]);

    expect(text).toMatch(/^2026-05-28 ETH execution-quality note:/);
    expect(text).toContain("StandX led benchmark venues at 2.10 bp median 100k taker slippage");
    expect(text).toContain("Nado was +2.30 bp vs StandX");
    expect(text).toContain("Reference only: Hyperliquid 1.40 bp");
    expect(text).toContain("Insufficient public depth: GRVT");
    expect(text).not.toMatch(/\b(buy|sell|long|short|alpha|signal)\b/i);
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
        depth3BpBidUsd: 300,
        depth3BpAskUsd: 300,
        depth3BpTotalUsd: 600,
        depth5BpBidUsd: 500,
        depth5BpAskUsd: 500,
        depth5BpTotalUsd: 1000,
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

    expect(btcSummary).toContain("no benchmark venue had enough valid public 100k taker slippage samples");
    expect(btcSummary).toContain("Reference only: Hyperliquid 100.00 bp.");
    expect(btcSummary).not.toContain("67.33 bp");
    db.close();
  });
});
