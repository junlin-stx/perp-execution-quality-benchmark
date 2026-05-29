import type { CollectionTarget, Venue } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchAevoOrderBook } from "./aevo.js";
import { fetchAsterOrderBook } from "./aster.js";
import { fetchEdgexOrderBook } from "./edgex.js";
import { fetchHyperliquidOrderBook } from "./hyperliquid.js";
import { fetchStandxOrderBook } from "./standx.js";

export interface ExchangeAdapter {
  fetchOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook>;
}

const adapters: Record<Venue, ExchangeAdapter> = {
  hyperliquid: { fetchOrderBook: fetchHyperliquidOrderBook },
  aevo: { fetchOrderBook: fetchAevoOrderBook },
  standx: { fetchOrderBook: fetchStandxOrderBook },
  aster: { fetchOrderBook: fetchAsterOrderBook },
  edgex: { fetchOrderBook: fetchEdgexOrderBook }
};

export function getAdapter(venue: Venue): ExchangeAdapter {
  return adapters[venue];
}
