import { collectionTargets, type CollectionTarget, type Market } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson, type JsonFetchOptions } from "./http.js";
import { parseNumber, parseTupleLevels, sortAsksAscending, sortBidsDescending } from "./parse.js";

export function normalizeStandxBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number,
  marketPayload?: unknown
): NormalizedOrderBook {
  const data = payload as { time?: unknown; bids?: unknown; asks?: unknown };
  const spreadOverrideBp = marketPayload === undefined ? undefined : parseStandxMarketSpreadBp(marketPayload);
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
    isPartial: false,
    ...(spreadOverrideBp === undefined ? {} : { spreadOverrideBp })
  };
}

export async function fetchStandxOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const depthUrl = `https://perps.standx.com/api/query_depth_book?symbol=${encodeURIComponent(target.symbol)}`;
  const marketUrl = `https://perps.standx.com/api/query_symbol_market?symbol=${encodeURIComponent(target.symbol)}`;
  const [{ data, latencyMs, localTimestampMs }, marketResult] = await Promise.all([
    fetchJson(depthUrl),
    fetchJson(marketUrl).catch(() => null)
  ]);
  return normalizeStandxBook(target.market, target.symbol, data, localTimestampMs, latencyMs, marketResult?.data);
}

function parseStandxMarketSpreadBp(payload: unknown): number | undefined {
  try {
    const data = payload as { bid1?: unknown; ask1?: unknown; spread?: unknown };
    const spread = Array.isArray(data.spread) ? data.spread : undefined;
    const bid = parseNumber(data.bid1 ?? spread?.[0], "standx.market.bid1");
    const ask = parseNumber(data.ask1 ?? spread?.[1], "standx.market.ask1");
    if (bid <= 0 || ask <= 0 || bid >= ask) return undefined;
    return ((ask - bid) / ((bid + ask) / 2)) * 10_000;
  } catch {
    return undefined;
  }
}

export async function fetchStandxListedSymbols(options: JsonFetchOptions = {}): Promise<Set<string>> {
  try {
    const { data } = await fetchJson("https://perps.standx.com/api/query_symbol_info", undefined, options);
    if (!Array.isArray(data)) throw new Error("invalid standx symbol info");
    return new Set(data.map((row) => String((row as { symbol?: unknown }).symbol)).filter(Boolean));
  } catch {
    return fetchStandxListedSymbolsFromMarketEndpoint(options);
  }
}

async function fetchStandxListedSymbolsFromMarketEndpoint(options: JsonFetchOptions): Promise<Set<string>> {
  const symbols = new Set<string>();
  const targets = collectionTargets.filter((target) => target.venue === "standx");
  await Promise.all(targets.map(async (target) => {
    const url = `https://perps.standx.com/api/query_symbol_market?symbol=${encodeURIComponent(target.symbol)}`;
    try {
      const { data } = await fetchJson(url, undefined, options);
      const symbol = String((data as { symbol?: unknown }).symbol ?? target.symbol);
      if (symbol) symbols.add(symbol);
    } catch {
      // Missing symbols return 404; keep them out of the listed set.
    }
  }));
  return symbols;
}
