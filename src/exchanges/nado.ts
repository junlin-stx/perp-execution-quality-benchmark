import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { sortAsksAscending, sortBidsDescending } from "./parse.js";

function parseX18(value: unknown, label: string): number {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) throw new Error(`invalid x18 number for ${label}`);
  return Number(BigInt(value)) / 1e18;
}

function parseNadoLevels(levels: unknown, label: string): BookLevel[] {
  if (!Array.isArray(levels)) throw new Error(`invalid ${label} levels`);
  return levels.map((level, index) => {
    if (!Array.isArray(level) || level.length < 2) throw new Error(`invalid ${label} level ${index}`);
    return {
      price: parseX18(level[0], `${label}.${index}.price`),
      size: parseX18(level[1], `${label}.${index}.size`)
    };
  });
}

export function normalizeNadoBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { data?: { bids?: unknown; asks?: unknown } };
  if (!data.data) throw new Error("invalid nado market liquidity");
  return {
    venue: "nado",
    market,
    symbol,
    source: "nado_market_liquidity",
    localTimestampMs,
    latencyMs,
    bids: sortBidsDescending(parseNadoLevels(data.data.bids, "nado.bids")),
    asks: sortAsksAscending(parseNadoLevels(data.data.asks, "nado.asks")),
    isPartial: true
  };
}

export async function fetchNadoOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const url = `https://gateway.prod.nado.xyz/v1/query?type=market_liquidity&product_id=${encodeURIComponent(target.symbol)}&depth=50`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url, {
    headers: { "accept-encoding": "gzip, br, deflate" }
  }, { retries: 1, retryDelayMs: 500 });
  return normalizeNadoBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
