import { describe, expect, it } from "vitest";
import { collectionTargets, markets, venues } from "../../src/config/markets.js";

describe("fixed benchmark universe", () => {
  it("keeps exactly 6 venues and 3 markets", () => {
    expect(venues).toEqual(["hyperliquid", "binance_perps", "aevo", "standx", "aster", "edgex"]);
    expect(markets).toEqual(["BTC", "ETH", "SOL"]);
    expect(collectionTargets).toHaveLength(18);
  });

  it("marks StandX SOL as not listed without replacing it", () => {
    const target = collectionTargets.find((item) => item.venue === "standx" && item.market === "SOL");
    expect(target).toMatchObject({ status: "not_listed", symbol: "SOL-USD" });
  });
});
