export const venues = ["hyperliquid", "binance_perps", "aevo", "standx"] as const;
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
  { venue: "binance_perps", market: "BTC", symbol: "BTCUSDT", status: "listed", source: "binance_usdm_depth" },
  { venue: "binance_perps", market: "ETH", symbol: "ETHUSDT", status: "listed", source: "binance_usdm_depth" },
  { venue: "binance_perps", market: "SOL", symbol: "SOLUSDT", status: "listed", source: "binance_usdm_depth" },
  { venue: "aevo", market: "BTC", symbol: "BTC-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "aevo", market: "ETH", symbol: "ETH-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "aevo", market: "SOL", symbol: "SOL-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "standx", market: "BTC", symbol: "BTC-USD", status: "listed", source: "standx_depth_book" },
  { venue: "standx", market: "ETH", symbol: "ETH-USD", status: "listed", source: "standx_depth_book" },
  { venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", source: "standx_symbol_info" }
];
