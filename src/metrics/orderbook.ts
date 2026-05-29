import type { BookLevel, ExecutionMetrics, NormalizedOrderBook, SideSlippage } from "../types/orderbook.js";

export function sortBids(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => b.price - a.price);
}

export function sortAsks(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => a.price - b.price);
}

export function sumDepthWithinBp(levels: BookLevel[], side: "bid" | "ask", bestPrice: number, bp: number): number {
  const distance = bp / 10_000;
  const limit = side === "bid" ? bestPrice * (1 - distance) : bestPrice * (1 + distance);
  return levels.reduce((sum, level) => {
    const inside = side === "bid" ? level.price >= limit : level.price <= limit;
    return inside ? sum + level.price * level.size : sum;
  }, 0);
}

export function estimateTakerSlippage(
  levels: BookLevel[],
  side: "buy" | "sell",
  targetUsd: number,
  midPrice: number
): SideSlippage {
  let remainingUsd = targetUsd;
  let totalBase = 0;
  let totalQuote = 0;

  for (const level of levels) {
    if (remainingUsd <= 0) break;
    const levelUsd = level.price * level.size;
    const takeUsd = Math.min(levelUsd, remainingUsd);
    const takeBase = takeUsd / level.price;
    totalQuote += takeUsd;
    totalBase += takeBase;
    remainingUsd -= takeUsd;
  }

  if (remainingUsd > 0 || totalBase === 0) {
    return { side, filledUsd: targetUsd - remainingUsd, averagePrice: null, slippageBp: null, insufficientDepth: true };
  }

  const averagePrice = totalQuote / totalBase;
  const slippageBp = side === "buy"
    ? ((averagePrice - midPrice) / midPrice) * 10_000
    : ((midPrice - averagePrice) / midPrice) * 10_000;

  return { side, filledUsd: targetUsd, averagePrice, slippageBp, insufficientDepth: false };
}

export function calculateExecutionMetrics(book: NormalizedOrderBook, targetUsd = 100_000): ExecutionMetrics {
  const bids = sortBids(book.bids);
  const asks = sortAsks(book.asks);
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;

  if (bestBid === undefined || bestAsk === undefined || bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
    return emptyMetrics(book, "invalid_orderbook");
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const buy = estimateTakerSlippage(asks, "buy", targetUsd, midPrice);
  const sell = estimateTakerSlippage(bids, "sell", targetUsd, midPrice);
  const insufficientDepth100k = buy.insufficientDepth || sell.insufficientDepth;
  const avgSlippage100kBp = insufficientDepth100k || buy.slippageBp === null || sell.slippageBp === null
    ? null
    : (buy.slippageBp + sell.slippageBp) / 2;

  const depth10BpBidUsd = sumDepthWithinBp(bids, "bid", bestBid, 10);
  const depth10BpAskUsd = sumDepthWithinBp(asks, "ask", bestAsk, 10);

  return {
    venue: book.venue,
    market: book.market,
    symbol: book.symbol,
    localTimestampMs: book.localTimestampMs,
    midPrice,
    spreadBp: ((bestAsk - bestBid) / midPrice) * 10_000,
    depth10BpBidUsd,
    depth10BpAskUsd,
    depth10BpTotalUsd: depth10BpBidUsd + depth10BpAskUsd,
    buySlippage100kBp: buy.slippageBp,
    sellSlippage100kBp: sell.slippageBp,
    avgSlippage100kBp,
    insufficientDepth100k,
    valid: true,
    error: null
  };
}

function emptyMetrics(book: NormalizedOrderBook, error: string): ExecutionMetrics {
  return {
    venue: book.venue,
    market: book.market,
    symbol: book.symbol,
    localTimestampMs: book.localTimestampMs,
    midPrice: null,
    spreadBp: null,
    depth10BpBidUsd: null,
    depth10BpAskUsd: null,
    depth10BpTotalUsd: null,
    buySlippage100kBp: null,
    sellSlippage100kBp: null,
    avgSlippage100kBp: null,
    insufficientDepth100k: false,
    valid: false,
    error
  };
}
