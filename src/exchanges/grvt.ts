import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, sortAsksAscending, sortBidsDescending } from "./parse.js";

function parseGrvtLevels(levels: unknown, label: string): BookLevel[] {
  if (!Array.isArray(levels)) throw new Error(`invalid ${label} levels`);
  return levels.map((level, index) => {
    const row = level as { price?: unknown; size?: unknown };
    return {
      price: parseNumber(row.price, `${label}.${index}.price`),
      size: parseNumber(row.size, `${label}.${index}.size`)
    };
  });
}

function parseNanosecondsToMilliseconds(value: unknown, label: string): number {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(BigInt(value) / 1_000_000n);
  }
  return parseNumber(value, label) / 1_000_000;
}

export function normalizeGrvtBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { result?: { event_time?: unknown; bids?: unknown; asks?: unknown } };
  if (!data.result) throw new Error("invalid grvt book result");
  return {
    venue: "grvt",
    market,
    symbol,
    source: "grvt_full_book",
    localTimestampMs,
    sourceTimestampMs: data.result.event_time === undefined ? undefined : parseNanosecondsToMilliseconds(data.result.event_time, "grvt.event_time"),
    latencyMs,
    bids: sortBidsDescending(parseGrvtLevels(data.result.bids, "grvt.bids")),
    asks: sortAsksAscending(parseGrvtLevels(data.result.asks, "grvt.asks")),
    isPartial: true
  };
}

export async function fetchGrvtOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const { data, latencyMs, localTimestampMs } = await fetchJson("https://market-data.grvt.io/full/v1/book", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instrument: target.symbol, depth: 50 })
  });
  return normalizeGrvtBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
