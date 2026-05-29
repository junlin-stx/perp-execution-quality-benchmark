import { describe, expect, it } from "vitest";
import { normalizeAevoBook } from "../../src/exchanges/aevo.js";
import { normalizeAsterBook } from "../../src/exchanges/aster.js";
import { normalizeEdgexBook } from "../../src/exchanges/edgex.js";
import { normalizeHyperliquidBook } from "../../src/exchanges/hyperliquid.js";
import { normalizeStandxBook } from "../../src/exchanges/standx.js";

describe("adapter normalization", () => {
  it("normalizes Hyperliquid level objects", () => {
    const book = normalizeHyperliquidBook("ETH", "ETH", { time: 2, levels: [[{ px: "99", sz: "4" }], [{ px: "100", sz: "5" }]] }, 1, 5);
    expect(book.bids[0]).toEqual({ price: 99, size: 4 });
    expect(book.asks[0]).toEqual({ price: 100, size: 5 });
  });

  it("normalizes Aevo array levels", () => {
    const book = normalizeAevoBook("SOL", "SOL-PERP", { last_updated: "2", bids: [["10", "6"]], asks: [["10.1", "7"]] }, 1, 5);
    expect(book.bids[0]).toEqual({ price: 10, size: 6 });
    expect(book.asks[0]).toEqual({ price: 10.1, size: 7 });
  });

  it("sorts StandX bids and asks", () => {
    const book = normalizeStandxBook("BTC", "BTC-USD", { time: 2, bids: [["99", "1"], ["100", "1"]], asks: [["102", "1"], ["101", "1"]] }, 1, 5);
    expect(book.bids.map((level) => level.price)).toEqual([100, 99]);
    expect(book.asks.map((level) => level.price)).toEqual([101, 102]);
  });

  it("normalizes Aster array levels", () => {
    const book = normalizeAsterBook("BTC", "BTCUSDT", { E: 2, bids: [["100", "2"]], asks: [["101", "3"]] }, 1, 5);
    expect(book.venue).toBe("aster");
    expect(book.source).toBe("aster_usdm_depth");
    expect(book.bids[0]).toEqual({ price: 100, size: 2 });
    expect(book.asks[0]).toEqual({ price: 101, size: 3 });
  });

  it("normalizes edgeX object levels from the depth snapshot", () => {
    const book = normalizeEdgexBook("ETH", "10000002", {
      data: [{
        contractName: "ETHUSD",
        asks: [{ price: "101", size: "3" }],
        bids: [{ price: "100", size: "2" }]
      }]
    }, 1, 5);
    expect(book.venue).toBe("edgex");
    expect(book.symbol).toBe("10000002");
    expect(book.bids[0]).toEqual({ price: 100, size: 2 });
    expect(book.asks[0]).toEqual({ price: 101, size: 3 });
  });
});
