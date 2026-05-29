import { describe, expect, it } from "vitest";
import { buildDailySummaryText } from "../../src/summary/daily.js";

describe("daily summary", () => {
  it("ranks venues by median 100k slippage and states not-listed markets", () => {
    const text = buildDailySummaryText("2026-05-28", "BTC", [
      { venue: "binance_perps", market: "BTC", medianSlippageBp: 1.2, status: "listed" },
      { venue: "hyperliquid", market: "BTC", medianSlippageBp: 1.6, status: "listed" },
      { venue: "aevo", market: "BTC", medianSlippageBp: 3.3, status: "listed" },
      { venue: "standx", market: "BTC", medianSlippageBp: 4.2, status: "listed" }
    ]);
    expect(text).toContain("Yesterday BTC 100k taker execution: Binance Perps best at 1.20 bp");
    expect(text).toContain("Hyperliquid +0.40 bp");
  });

  it("mentions StandX SOL as not listed", () => {
    const text = buildDailySummaryText("2026-05-28", "SOL", [
      { venue: "standx", market: "SOL", medianSlippageBp: null, status: "not_listed" }
    ]);
    expect(text).toContain("StandX SOL was not listed");
  });
});
