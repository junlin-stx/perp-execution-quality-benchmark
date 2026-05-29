import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, NormalizedOrderBook } from "../types/orderbook.js";
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

export function normalizeHyperliquidBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { time?: unknown; levels?: unknown };
  if (!Array.isArray(data.levels) || data.levels.length < 2) throw new Error("invalid hyperliquid levels");
  return {
    venue: "hyperliquid",
    market,
    symbol,
    source: "hyperliquid_l2_book",
    localTimestampMs,
    sourceTimestampMs: data.time === undefined ? undefined : parseNumber(data.time, "hyperliquid.time"),
    latencyMs,
    bids: sortBidsDescending(parseHyperliquidLevels(data.levels[0], "hyperliquid.bids")),
    asks: sortAsksAscending(parseHyperliquidLevels(data.levels[1], "hyperliquid.asks")),
    isPartial: true
  };
}

export async function fetchHyperliquidOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const { data, latencyMs, localTimestampMs } = await fetchJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "l2Book", coin: target.symbol })
  });
  return normalizeHyperliquidBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
