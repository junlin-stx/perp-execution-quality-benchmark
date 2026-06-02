import { describe, expect, it } from "vitest";
import { formatCollectionDoneLog, formatCollectionSuccessLog } from "../../src/collector/run.js";

describe("collector logging", () => {
  it("formats successful collection samples with book shape and key metrics", () => {
    const line = formatCollectionSuccessLog({
      venue: "standx",
      market: "BTC",
      symbol: "BTC-USD",
      bidCount: 10,
      askCount: 12,
      latencyMs: 34,
      spreadBp: 1.23456,
      depth3BpTotalUsd: 1000,
      depth5BpTotalUsd: 2000,
      depth10BpTotalUsd: 3000,
      avgSlippage100kBp: 4.56789,
      avgSlippage1mBp: null
    });

    expect(line).toContain("[collect] ok venue=standx market=BTC symbol=BTC-USD");
    expect(line).toContain("bids=10 asks=12 latency_ms=34");
    expect(line).toContain("spread_bp=1.235");
    expect(line).toContain("depth_3bp_usd=1000");
    expect(line).toContain("depth_5bp_usd=2000");
    expect(line).toContain("depth_10bp_usd=3000");
    expect(line).toContain("slippage_100k_bp=4.568");
    expect(line).toContain("slippage_1m_bp=N/A");
  });

  it("formats round completion with elapsed time", () => {
    expect(formatCollectionDoneLog({ collected: 8, failed: 1, notListed: 2, durationMs: 1234 }))
      .toBe("[collect] done collected=8 failed=1 not_listed=2 duration_ms=1234");
  });
});
