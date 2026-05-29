import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, sortAsksAscending, sortBidsDescending } from "./parse.js";

function parseEdgexLevels(levels: unknown, label: string): BookLevel[] {
  if (!Array.isArray(levels)) throw new Error(`invalid ${label} levels`);
  return levels.map((level, index) => {
    const row = level as { price?: unknown; size?: unknown };
    return {
      price: parseNumber(row.price, `${label}.${index}.price`),
      size: parseNumber(row.size, `${label}.${index}.size`)
    };
  });
}

export function normalizeEdgexBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { data?: unknown };
  const snapshots = Array.isArray(data.data) ? data.data : [];
  const snapshot = snapshots[0] as { contractName?: unknown; asks?: unknown; bids?: unknown; endVersion?: unknown } | undefined;
  if (!snapshot) throw new Error("invalid edgex depth snapshot");
  return {
    venue: "edgex",
    market,
    symbol,
    source: "edgex_depth",
    localTimestampMs,
    sourceTimestampMs: snapshot.endVersion === undefined ? undefined : parseNumber(snapshot.endVersion, "edgex.endVersion"),
    latencyMs,
    bids: sortBidsDescending(parseEdgexLevels(snapshot.bids, "edgex.bids")),
    asks: sortAsksAscending(parseEdgexLevels(snapshot.asks, "edgex.asks")),
    isPartial: true
  };
}

export async function fetchEdgexOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://pro.edgex.exchange/api/v1/public/quote/getDepth?contractId=${encodeURIComponent(target.symbol)}&level=200`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeEdgexBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
