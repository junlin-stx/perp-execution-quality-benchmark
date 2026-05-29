import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, sortAsksAscending, sortBidsDescending } from "./parse.js";

function parseExtendedLevels(levels: unknown, label: string): BookLevel[] {
  if (!Array.isArray(levels)) throw new Error(`invalid ${label} levels`);
  return levels.map((level, index) => {
    const row = level as { price?: unknown; qty?: unknown };
    return {
      price: parseNumber(row.price, `${label}.${index}.price`),
      size: parseNumber(row.qty, `${label}.${index}.qty`)
    };
  });
}

export function normalizeExtendedBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { data?: { bid?: unknown; ask?: unknown } };
  if (!data.data) throw new Error("invalid extended orderbook");
  return {
    venue: "extended",
    market,
    symbol,
    source: "extended_orderbook",
    localTimestampMs,
    latencyMs,
    bids: sortBidsDescending(parseExtendedLevels(data.data.bid, "extended.bid")),
    asks: sortAsksAscending(parseExtendedLevels(data.data.ask, "extended.ask")),
    isPartial: true
  };
}

export async function fetchExtendedOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://api.starknet.extended.exchange/api/v1/info/markets/${encodeURIComponent(target.symbol)}/orderbook`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeExtendedBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
