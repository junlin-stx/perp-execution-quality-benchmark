import type { CollectionTarget, Market } from "../config/markets.js";
import type { BookLevel, NormalizedOrderBook } from "../types/orderbook.js";
import { fetchJson } from "./http.js";
import { parseNumber, sortAsksAscending, sortBidsDescending } from "./parse.js";

const lighterMarketIds: Record<Market, number> = {
  BTC: 1,
  ETH: 0,
  SOL: 2
};

function aggregateLighterOrders(orders: unknown, label: string): BookLevel[] {
  if (!Array.isArray(orders)) throw new Error(`invalid ${label} orders`);
  const levels = new Map<number, number>();
  for (const [index, order] of orders.entries()) {
    const row = order as { price?: unknown; remaining_base_amount?: unknown; size?: unknown };
    const price = parseNumber(row.price, `${label}.${index}.price`);
    const size = parseNumber(row.remaining_base_amount ?? row.size, `${label}.${index}.size`);
    levels.set(price, (levels.get(price) ?? 0) + size);
  }
  return [...levels.entries()].map(([price, size]) => ({ price, size }));
}

export function normalizeLighterBook(
  market: Market,
  symbol: string,
  payload: unknown,
  localTimestampMs: number,
  latencyMs: number
): NormalizedOrderBook {
  const data = payload as { bids?: unknown; asks?: unknown };
  return {
    venue: "lighter",
    market,
    symbol,
    source: "lighter_order_book_orders",
    localTimestampMs,
    latencyMs,
    bids: sortBidsDescending(aggregateLighterOrders(data.bids, "lighter.bids")),
    asks: sortAsksAscending(aggregateLighterOrders(data.asks, "lighter.asks")),
    isPartial: true
  };
}

export async function fetchLighterOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook> {
  const marketId = lighterMarketIds[target.market];
  const url = `https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id=${marketId}&limit=250`;
  const { data, latencyMs, localTimestampMs } = await fetchJson(url);
  return normalizeLighterBook(target.market, target.symbol, data, localTimestampMs, latencyMs);
}
