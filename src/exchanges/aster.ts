import type { CollectionTarget, Market } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, parseTupleLevels, sortAsksAscending, sortBidsDescending } from "./parse.js";

export function normalizeAsterBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { E?: unknown; T?: unknown; bids?: unknown; asks?: unknown };
  const bids = sortBidsDescending(parseTupleLevels(data.bids, "aster.bids"));
  const asks = sortAsksAscending(parseTupleLevels(data.asks, "aster.asks"));
  const sourceTimestamp = data.E ?? data.T;
  return {
    venue: "aster",
    market,
    symbol,
    source: "aster_usdm_depth",
    localTimestampMs,
    sourceTimestampMs: sourceTimestamp === undefined ? undefined : parseNumber(sourceTimestamp, "aster.timestamp"),
    latencyMs,
    bids,
    asks,
    isPartial: true
  };
}

export async function fetchAsterOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://fapi.asterdex.com/fapi/v1/depth?symbol=${encodeURIComponent(target.symbol)}&limit=1000`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeAsterBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
