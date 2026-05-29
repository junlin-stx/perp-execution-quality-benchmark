export const venues = ["hyperliquid", "aevo", "standx", "aster", "edgex", "grvt", "lighter"] as const;
export const markets = ["BTC", "ETH", "SOL"] as const;

export type Venue = (typeof venues)[number];
export type Market = (typeof markets)[number];
export type VenueMarketStatus = "listed" | "not_listed";

export interface CollectionTarget {
  venue: Venue;
  market: Market;
  symbol: string;
  status: VenueMarketStatus;
  source: string;
}

export const collectionTargets: CollectionTarget[] = [
  { venue: "hyperliquid", market: "BTC", symbol: "BTC", status: "listed", source: "hyperliquid_l2_book" },
  { venue: "hyperliquid", market: "ETH", symbol: "ETH", status: "listed", source: "hyperliquid_l2_book" },
  { venue: "hyperliquid", market: "SOL", symbol: "SOL", status: "listed", source: "hyperliquid_l2_book" },
  { venue: "aevo", market: "BTC", symbol: "BTC-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "aevo", market: "ETH", symbol: "ETH-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "aevo", market: "SOL", symbol: "SOL-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "standx", market: "BTC", symbol: "BTC-USD", status: "listed", source: "standx_depth_book" },
  { venue: "standx", market: "ETH", symbol: "ETH-USD", status: "listed", source: "standx_depth_book" },
  { venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", source: "standx_symbol_info" },
  { venue: "aster", market: "BTC", symbol: "BTCUSDT", status: "listed", source: "aster_usdm_depth" },
  { venue: "aster", market: "ETH", symbol: "ETHUSDT", status: "listed", source: "aster_usdm_depth" },
  { venue: "aster", market: "SOL", symbol: "SOLUSDT", status: "listed", source: "aster_usdm_depth" },
  { venue: "edgex", market: "BTC", symbol: "10000001", status: "listed", source: "edgex_depth" },
  { venue: "edgex", market: "ETH", symbol: "10000002", status: "listed", source: "edgex_depth" },
  { venue: "edgex", market: "SOL", symbol: "10000003", status: "listed", source: "edgex_depth" },
  { venue: "grvt", market: "BTC", symbol: "BTC_USDT_Perp", status: "listed", source: "grvt_full_book" },
  { venue: "grvt", market: "ETH", symbol: "ETH_USDT_Perp", status: "listed", source: "grvt_full_book" },
  { venue: "grvt", market: "SOL", symbol: "SOL_USDT_Perp", status: "listed", source: "grvt_full_book" },
  { venue: "lighter", market: "BTC", symbol: "BTC", status: "listed", source: "lighter_order_book_orders" },
  { venue: "lighter", market: "ETH", symbol: "ETH", status: "listed", source: "lighter_order_book_orders" },
  { venue: "lighter", market: "SOL", symbol: "SOL", status: "listed", source: "lighter_order_book_orders" }
];
