import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHyperliquidOrderBook } from "../../src/exchanges/hyperliquid.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Hyperliquid order book fetching", () => {
  it("fetches full-precision and progressively aggregated books", async () => {
    const requests: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      return new Response(JSON.stringify({
        time: 123,
        levels: [
          [{ px: "100", sz: "1" }, { px: "99", sz: "1" }],
          [{ px: "101", sz: "1" }, { px: "102", sz: "1" }]
        ]
      }), { status: 200 });
    }) as typeof fetch;

    const book = await fetchHyperliquidOrderBook({
      venue: "hyperliquid",
      market: "BTC",
      symbol: "BTC",
      status: "listed",
      source: "hyperliquid_l2_book"
    });

    expect(requests).toEqual([
      { type: "l2Book", coin: "BTC", nSigFigs: null },
      { type: "l2Book", coin: "BTC", nSigFigs: 5, mantissa: 2 },
      { type: "l2Book", coin: "BTC", nSigFigs: 5, mantissa: 5 },
      { type: "l2Book", coin: "BTC", nSigFigs: 4 }
    ]);
    expect(book.depthBookVariants?.map((variant) => variant.aggregation)).toEqual(["5sf-m2", "5sf-m5", "4sf"]);
    expect(book.depthBookMaxLevels).toBe(20);
  });
});
