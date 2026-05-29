import type { CollectionTarget, Market } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, parseTupleLevels, sortAsksAscending, sortBidsDescending } from "./parse.js";

export function normalizeStandxBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { time?: unknown; bids?: unknown; asks?: unknown };
  return {
    venue: "standx",
    market,
    symbol,
    source: "standx_depth_book",
    localTimestampMs,
    sourceTimestampMs: data.time === undefined ? undefined : parseNumber(data.time, "standx.time"),
    latencyMs,
    bids: sortBidsDescending(parseTupleLevels(data.bids, "standx.bids")),
    asks: sortAsksAscending(parseTupleLevels(data.asks, "standx.asks")),
    isPartial: false
  };
}

export async function fetchStandxOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://perps.standx.com/api/query_depth_book?symbol=${encodeURIComponent(target.symbol)}`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeStandxBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}

export async function fetchStandxListedSymbols(): Promise<Set<string>> {
  const { data } = await fetchJson("https://perps.standx.com/api/query_symbol_info");
  if (!Array.isArray(data)) throw new Error("invalid standx symbol info");
  return new Set(data.map((row) => String((row as { symbol?: unknown }).symbol)).filter(Boolean));
}
