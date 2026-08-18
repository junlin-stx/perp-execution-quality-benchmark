import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, DepthBookVariant, NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, sortAsksAscending, sortBidsDescending } from "./parse.js";

function parseHyperliquidLevels(levels: unknown, label: string): BookLevel[] {
  if (!Array.isArray(levels)) throw new Error(`invalid ${label} levels`);
  return levels.map((level, index) => {
    const row = level as { px?: unknown; sz?: unknown };
    return {
      price: parseNumber(row.px, `${label}.${index}.px`),
      size: parseNumber(row.sz, `${label}.${index}.sz`)
    };
  });
}

function parseHyperliquidDepthVariant(payload: unknown, aggregation: string): DepthBookVariant {
  const data = payload as { time?: unknown; levels?: unknown };
  if (!Array.isArray(data.levels) || data.levels.length < 2) throw new Error("invalid hyperliquid levels");
  return {
    aggregation,
    sourceTimestampMs: data.time === undefined ? undefined : parseNumber(data.time, "hyperliquid.time"),
    bids: sortBidsDescending(parseHyperliquidLevels(data.levels[0], "hyperliquid.bids")),
    asks: sortAsksAscending(parseHyperliquidLevels(data.levels[1], "hyperliquid.asks"))
  };
}

export function normalizeHyperliquidBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const parsed = parseHyperliquidDepthVariant(payload, "full");
  return {
    venue: "hyperliquid",
    market,
    symbol,
    source: "hyperliquid_l2_book",
    localTimestampMs,
    sourceTimestampMs: parsed.sourceTimestampMs,
    latencyMs,
    bids: parsed.bids,
    asks: parsed.asks,
    isPartial: true
  };
}

export async function fetchHyperliquidOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const fetchBook = (request: Record<string, unknown>) => fetchJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "l2Book", coin: target.symbol, ...request })
  });
  const variantRequests = [
    { aggregation: "5sf-m2", request: { nSigFigs: 5, mantissa: 2 } },
    { aggregation: "5sf-m5", request: { nSigFigs: 5, mantissa: 5 } },
    { aggregation: "4sf", request: { nSigFigs: 4 } }
  ];
  const [full, ...variantResults] = await Promise.all([
    fetchBook({ nSigFigs: null }),
    ...variantRequests.map(({ aggregation, request }) => fetchBook(request)
      .then(({ data }) => parseHyperliquidDepthVariant(data, aggregation))
      .catch(() => null))
  ]);
  const book = normalizeHyperliquidBook(target.market, target.symbol, full.data, full.localTimestampMs, full.latencyMs);
  return {
    ...book,
    depthBookVariants: variantResults.filter((variant): variant is DepthBookVariant => variant !== null),
    depthBookMaxLevels: 20
  };
}
