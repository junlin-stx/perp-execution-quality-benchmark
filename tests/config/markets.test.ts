import { describe, expect, it } from "vitest";
import { collectionTargets, markets, venues } from "../../src/config/markets.js";

describe("fixed benchmark universe", () => {
  it("keeps exactly 8 venues and 3 markets", () => {
    expect(venues).toEqual(["hyperliquid", "standx", "aster", "edgex", "grvt", "lighter", "extended", "nado"]);
    expect(markets).toEqual(["BTC", "ETH", "SOL"]);
    expect(collectionTargets).toHaveLength(24);
    expect(JSON.stringify(collectionTargets)).not.toContain("binance_perps");
    expect(JSON.stringify(collectionTargets)).not.toContain("aevo");
  });

  it("tracks StandX SOL as a listed depth-book target", () => {
    const target = collectionTargets.find((item) => item.venue === "standx" && item.market === "SOL");
    expect(target).toMatchObject({ status: "listed", symbol: "SOL-USD", source: "standx_depth_book" });
  });

  it("includes GRVT and Lighter BTC ETH SOL targets", () => {
    expect(collectionTargets.filter((item) => item.venue === "grvt").map((item) => item.symbol)).toEqual([
      "BTC_USDT_Perp",
      "ETH_USDT_Perp",
      "SOL_USDT_Perp"
    ]);
    expect(collectionTargets.filter((item) => item.venue === "lighter").map((item) => item.symbol)).toEqual(["BTC", "ETH", "SOL"]);
  });

  it("includes Extended and Nado BTC ETH SOL targets", () => {
    expect(collectionTargets.filter((item) => item.venue === "extended").map((item) => item.symbol)).toEqual(["BTC-USD", "ETH-USD", "SOL-USD"]);
    expect(collectionTargets.filter((item) => item.venue === "nado").map((item) => item.symbol)).toEqual(["2", "4", "8"]);
  });
});
