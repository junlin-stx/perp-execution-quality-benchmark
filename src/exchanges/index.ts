import type { CollectionTarget, Venue } from "../config/markets.js";
import type { NormalizedOrderBook } from "../types/orderbook.js";
import { fetchAsterOrderBook } from "./aster.js";
import { fetchEdgexOrderBook } from "./edgex.js";
import { fetchExtendedOrderBook } from "./extended.js";
import { fetchGrvtOrderBook } from "./grvt.js";
import { fetchHyperliquidOrderBook } from "./hyperliquid.js";
import { fetchLighterOrderBook } from "./lighter.js";
import { fetchNadoOrderBook } from "./nado.js";
import { fetchStandxOrderBook } from "./standx.js";

export interface ExchangeAdapter {
  fetchOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook>;
}

const adapters: Record<Venue, ExchangeAdapter> = {
  hyperliquid: { fetchOrderBook: fetchHyperliquidOrderBook },
  standx: { fetchOrderBook: fetchStandxOrderBook },
  aster: { fetchOrderBook: fetchAsterOrderBook },
  edgex: { fetchOrderBook: fetchEdgexOrderBook },
  grvt: { fetchOrderBook: fetchGrvtOrderBook },
  lighter: { fetchOrderBook: fetchLighterOrderBook },
  extended: { fetchOrderBook: fetchExtendedOrderBook },
  nado: { fetchOrderBook: fetchNadoOrderBook }
};

export function getAdapter(venue: Venue): ExchangeAdapter {
  return adapters[venue];
}
