import type { CollectionTarget, Market } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, parseTupleLevels, sortAsksAscending, sortBidsDescending } from "./parse.js";

export function normalizeBinanceBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { E?: unknown; T?: unknown; bids?: unknown; asks?: unknown };
  const bids = sortBidsDescending(parseTupleLevels(data.bids, "binance.bids"));
  const asks = sortAsksAscending(parseTupleLevels(data.asks, "binance.asks"));
  const sourceTimestamp = data.E ?? data.T;
  return {
    venue: "binance_perps",
    market,
    symbol,
    source: "binance_usdm_depth",
    localTimestampMs,
    sourceTimestampMs: sourceTimestamp === undefined ? undefined : parseNumber(sourceTimestamp, "binance.timestamp"),
    latencyMs,
    bids,
    asks,
    isPartial: true
  };
}

export async function fetchBinanceOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://fapi.binance.com/fapi/v1/depth?symbol=${encodeURIComponent(target.symbol)}&limit=1000`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeBinanceBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
