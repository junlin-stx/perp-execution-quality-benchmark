import type { CollectionTarget, Market } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, parseTupleLevels, sortAsksAscending, sortBidsDescending } from "./parse.js";

export function normalizeAevoBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { last_updated?: unknown; bids?: unknown; asks?: unknown };
  const rawTimestamp = data.last_updated === undefined ? undefined : parseNumber(data.last_updated, "aevo.last_updated");
  return {
    venue: "aevo",
    market,
    symbol,
    source: "aevo_orderbook",
    localTimestampMs,
    sourceTimestampMs: rawTimestamp === undefined ? undefined : Math.floor(rawTimestamp / 1_000_000),
    latencyMs,
    bids: sortBidsDescending(parseTupleLevels(data.bids, "aevo.bids")),
    asks: sortAsksAscending(parseTupleLevels(data.asks, "aevo.asks")),
    isPartial: false
  };
}

export async function fetchAevoOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://api.aevo.xyz/orderbook?instrument_name=${encodeURIComponent(target.symbol)}`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeAevoBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
