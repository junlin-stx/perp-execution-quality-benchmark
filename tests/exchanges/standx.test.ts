import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStandxListedSymbols } from "../../src/exchanges/standx.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("StandX adapter", () => {
  it("falls back to symbol market endpoint when symbol info is unavailable", async () => {
    const urls: string[] = [];
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("query_symbol_info")) {
        return new Response("unavailable", { status: 503 });
      }
      if (url.includes("symbol=SOL-USD")) {
        return new Response("not found", { status: 404 });
      }
      return new Response(JSON.stringify({ symbol: url.includes("BTC-USD") ? "BTC-USD" : "ETH-USD" }), { status: 200 });
    }) as typeof fetch;

    const symbols = await fetchStandxListedSymbols({ retryDelayMs: 1 });

    expect(symbols).toEqual(new Set(["BTC-USD", "ETH-USD"]));
    expect(urls.some((url) => url.includes("query_symbol_market?symbol=BTC-USD"))).toBe(true);
    expect(urls.some((url) => url.includes("query_symbol_market?symbol=ETH-USD"))).toBe(true);
    expect(urls.some((url) => url.includes("query_symbol_market?symbol=SOL-USD"))).toBe(true);
  });
});
