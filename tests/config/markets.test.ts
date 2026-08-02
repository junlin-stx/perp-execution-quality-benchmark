import { describe, expect, it } from "vitest";
import { collectionTargets, markets, venues } from "../../src/config/markets.js";

describe("fixed benchmark universe", () => {
  it("keeps exactly 8 venues and 4 markets", () => {
    expect(venues).toEqual(["hyperliquid", "standx", "aster", "edgex", "grvt", "lighter", "extended", "nado"]);
    expect(markets).toEqual(["BTC", "ETH", "SOL", "XAU"]);
    expect(collectionTargets).toHaveLength(32);
    expect(JSON.stringify(collectionTargets)).not.toContain("binance_perps");
    expect(JSON.stringify(collectionTargets)).not.toContain("aevo");
  });

  it("tracks StandX SOL as a listed depth-book target", () => {
    const target = collectionTargets.find((item) => item.venue === "standx" && item.market === "SOL");
    expect(target).toMatchObject({ status: "listed", symbol: "SOL-USD", source: "standx_depth_book" });
  });

  it("tracks XAU with each venue's live public symbol", () => {
    expect(collectionTargets.filter((item) => item.market === "XAU")).toEqual([
      { venue: "hyperliquid", market: "XAU", symbol: "xyz:GOLD", status: "listed", source: "hyperliquid_l2_book" },
      { venue: "standx", market: "XAU", symbol: "XAU-USD", status: "listed", source: "standx_depth_book" },
      { venue: "aster", market: "XAU", symbol: "XAUUSDT", status: "listed", source: "aster_usdm_depth" },
      { venue: "edgex", market: "XAU", symbol: "10000234", status: "listed", source: "edgex_depth" },
      { venue: "grvt", market: "XAU", symbol: "XAU_USDT_Perp", status: "listed", source: "grvt_full_book" },
      { venue: "lighter", market: "XAU", symbol: "XAU", status: "listed", source: "lighter_order_book_orders" },
      { venue: "extended", market: "XAU", symbol: "XAU-USD", status: "listed", source: "extended_orderbook" },
      { venue: "nado", market: "XAU", symbol: "28", status: "listed", source: "nado_market_liquidity" }
    ]);
  });

  it("includes GRVT and Lighter targets", () => {
    expect(collectionTargets.filter((item) => item.venue === "grvt").map((item) => item.symbol)).toEqual([
      "BTC_USDT_Perp",
      "ETH_USDT_Perp",
      "SOL_USDT_Perp",
      "XAU_USDT_Perp"
    ]);
    expect(collectionTargets.filter((item) => item.venue === "lighter").map((item) => item.symbol)).toEqual(["BTC", "ETH", "SOL", "XAU"]);
  });

  it("includes Extended and Nado targets", () => {
    expect(collectionTargets.filter((item) => item.venue === "extended").map((item) => item.symbol)).toEqual(["BTC-USD", "ETH-USD", "SOL-USD", "XAU-USD"]);
    expect(collectionTargets.filter((item) => item.venue === "nado").map((item) => item.symbol)).toEqual(["2", "4", "8", "28"]);
  });
});
