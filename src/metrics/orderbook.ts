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

function coversDepthBand(
  bids: BookLevel[],
  asks: BookLevel[],
  bestBid: number,
  bestAsk: number,
  bp: number,
  maxLevels?: number
): boolean {
  if (!bids.length || !asks.length) return false;
  const distance = bp / 10_000;
  const bidBoundary = bestBid * (1 - distance);
  const askBoundary = bestAsk * (1 + distance);
  const bidComplete = maxLevels !== undefined && bids.length < maxLevels;
  const askComplete = maxLevels !== undefined && asks.length < maxLevels;
  return (bidComplete || bids[bids.length - 1].price <= bidBoundary)
    && (askComplete || asks[asks.length - 1].price >= askBoundary);
}

function calculateDepthBand(
  book: NormalizedOrderBook,
  bids: BookLevel[],
  asks: BookLevel[],
  bestBid: number,
  bestAsk: number,
  bp: number
): { bidUsd: number | null; askUsd: number | null; totalUsd: number | null } {
  if (book.depthBookVariants === undefined) {
    const bidUsd = sumDepthWithinBp(bids, "bid", bestBid, bp);
    const askUsd = sumDepthWithinBp(asks, "ask", bestAsk, bp);
    return { bidUsd, askUsd, totalUsd: bidUsd + askUsd };
  }

  const candidates = [
    { bids, asks },
    ...book.depthBookVariants.map((variant) => ({
      bids: sortBids(variant.bids),
      asks: sortAsks(variant.asks)
    }))
  ];
  const candidate = candidates.find((item) => coversDepthBand(
    item.bids,
    item.asks,
    bestBid,
    bestAsk,
    bp,
    book.depthBookMaxLevels
  ));
  if (!candidate) return { bidUsd: null, askUsd: null, totalUsd: null };
  const bidUsd = sumDepthWithinBp(candidate.bids, "bid", bestBid, bp);
  const askUsd = sumDepthWithinBp(candidate.asks, "ask", bestAsk, bp);
  return { bidUsd, askUsd, totalUsd: bidUsd + askUsd };
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

export function calculateExecutionMetrics(book: NormalizedOrderBook): ExecutionMetrics {
  const bids = sortBids(book.bids);
  const asks = sortAsks(book.asks);
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;

  if (bestBid === undefined || bestAsk === undefined || bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
    return emptyMetrics(book, "invalid_orderbook");
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const buy = estimateTakerSlippage(asks, "buy", 100_000, midPrice);
  const sell = estimateTakerSlippage(bids, "sell", 100_000, midPrice);
  const insufficientDepth100k = buy.insufficientDepth || sell.insufficientDepth;
  const avgSlippage100kBp = insufficientDepth100k || buy.slippageBp === null || sell.slippageBp === null
    ? null
    : (buy.slippageBp + sell.slippageBp) / 2;
  const buy1m = estimateTakerSlippage(asks, "buy", 1_000_000, midPrice);
  const sell1m = estimateTakerSlippage(bids, "sell", 1_000_000, midPrice);
  const insufficientDepth1m = buy1m.insufficientDepth || sell1m.insufficientDepth;
  const avgSlippage1mBp = insufficientDepth1m || buy1m.slippageBp === null || sell1m.slippageBp === null
    ? null
    : (buy1m.slippageBp + sell1m.slippageBp) / 2;

  const depth3Bp = calculateDepthBand(book, bids, asks, bestBid, bestAsk, 3);
  const depth5Bp = calculateDepthBand(book, bids, asks, bestBid, bestAsk, 5);
  const depth10Bp = calculateDepthBand(book, bids, asks, bestBid, bestAsk, 10);

  return {
    venue: book.venue,
    market: book.market,
    symbol: book.symbol,
    localTimestampMs: book.localTimestampMs,
    midPrice,
    spreadBp: book.spreadOverrideBp ?? ((bestAsk - bestBid) / midPrice) * 10_000,
    depth3BpBidUsd: depth3Bp.bidUsd,
    depth3BpAskUsd: depth3Bp.askUsd,
    depth3BpTotalUsd: depth3Bp.totalUsd,
    depth5BpBidUsd: depth5Bp.bidUsd,
    depth5BpAskUsd: depth5Bp.askUsd,
    depth5BpTotalUsd: depth5Bp.totalUsd,
    depth10BpBidUsd: depth10Bp.bidUsd,
    depth10BpAskUsd: depth10Bp.askUsd,
    depth10BpTotalUsd: depth10Bp.totalUsd,
    buySlippage100kBp: buy.slippageBp,
    sellSlippage100kBp: sell.slippageBp,
    avgSlippage100kBp,
    insufficientDepth100k,
    buySlippage1mBp: buy1m.slippageBp,
    sellSlippage1mBp: sell1m.slippageBp,
    avgSlippage1mBp,
    insufficientDepth1m,
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
    depth3BpBidUsd: null,
    depth3BpAskUsd: null,
    depth3BpTotalUsd: null,
    depth5BpBidUsd: null,
    depth5BpAskUsd: null,
    depth5BpTotalUsd: null,
    depth10BpBidUsd: null,
    depth10BpAskUsd: null,
    depth10BpTotalUsd: null,
    buySlippage100kBp: null,
    sellSlippage100kBp: null,
    avgSlippage100kBp: null,
    insufficientDepth100k: false,
    buySlippage1mBp: null,
    sellSlippage1mBp: null,
    avgSlippage1mBp: null,
    insufficientDepth1m: false,
    valid: false,
    error
  };
}
