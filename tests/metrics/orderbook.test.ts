import { describe, expect, it } from "vitest";
import { calculateExecutionMetrics, estimateTakerSlippage, sumDepthWithinBp } from "../../src/metrics/orderbook.js";
import type { NormalizedOrderBook } from "../../src/types/orderbook.js";

const book: NormalizedOrderBook = {
  venue: "hyperliquid",
  market: "BTC",
  symbol: "BTC",
  source: "fixture",
  localTimestampMs: 1,
  latencyMs: 12,
  bids: [
    { price: 100, size: 500 },
    { price: 99.95, size: 400 },
    { price: 99.8, size: 1000 },
    { price: 95, size: 10_000 }
  ],
  asks: [
    { price: 100.1, size: 500 },
    { price: 100.15, size: 400 },
    { price: 100.4, size: 1000 },
    { price: 105, size: 10_000 }
  ],
  isPartial: false
};

describe("orderbook metrics", () => {
  it("calculates spread and 3bp, 5bp, and 10bp depth", () => {
    const metrics = calculateExecutionMetrics(book);
    expect(metrics.midPrice).toBeCloseTo(100.05);
    expect(metrics.spreadBp).toBeCloseTo(9.995);
    expect(metrics.depth3BpBidUsd).toBeCloseTo(50_000);
    expect(metrics.depth3BpAskUsd).toBeCloseTo(50_050);
    expect(metrics.depth3BpTotalUsd).toBeCloseTo(100_050);
    expect(metrics.depth5BpBidUsd).toBeCloseTo(89_980);
    expect(metrics.depth5BpAskUsd).toBeCloseTo(90_110);
    expect(metrics.depth5BpTotalUsd).toBeCloseTo(180_090);
    expect(metrics.depth10BpBidUsd).toBeCloseTo(89980);
    expect(metrics.depth10BpAskUsd).toBeCloseTo(90110);
    expect(metrics.depth10BpTotalUsd).toBeCloseTo(180090);
  });

  it("uses a quote spread override without changing depth or mid price", () => {
    const metrics = calculateExecutionMetrics({ ...book, spreadOverrideBp: 1.23 });
    expect(metrics.midPrice).toBeCloseTo(100.05);
    expect(metrics.spreadBp).toBeCloseTo(1.23);
    expect(metrics.depth10BpTotalUsd).toBeCloseTo(180090);
  });

  it("simulates 100k buy and sell taker slippage", () => {
    const buy = estimateTakerSlippage(book.asks, "buy", 100_000, 100.05);
    const sell = estimateTakerSlippage(book.bids, "sell", 100_000, 100.05);
    expect(buy.insufficientDepth).toBe(false);
    expect(sell.insufficientDepth).toBe(false);
    expect(buy.slippageBp).toBeGreaterThan(0);
    expect(sell.slippageBp).toBeGreaterThan(0);
  });

  it("calculates 1m buy and sell taker slippage separately from 100k", () => {
    const metrics = calculateExecutionMetrics(book);
    expect(metrics.insufficientDepth1m).toBe(false);
    expect(metrics.buySlippage1mBp).toBeGreaterThan(metrics.buySlippage100kBp ?? 0);
    expect(metrics.sellSlippage1mBp).toBeGreaterThan(metrics.sellSlippage100kBp ?? 0);
    expect(metrics.avgSlippage1mBp).toBeGreaterThan(metrics.avgSlippage100kBp ?? 0);
  });

  it("marks insufficient depth instead of returning zero", () => {
    const result = estimateTakerSlippage([{ price: 100, size: 1 }], "buy", 100_000, 100);
    expect(result.insufficientDepth).toBe(true);
    expect(result.slippageBp).toBeNull();
  });

  it("sums depth inside a bp band", () => {
    expect(sumDepthWithinBp(book.bids, "bid", 100, 10)).toBeCloseTo(89980);
    expect(sumDepthWithinBp(book.asks, "ask", 100.1, 10)).toBeCloseTo(90110);
  });
});
