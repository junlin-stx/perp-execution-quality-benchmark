import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "../../src/exchanges/http.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("retries transient fetch failures before succeeding", async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("fetch failed");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const result = await fetchJson("https://example.test/data", undefined, { retries: 2, retryDelayMs: 1 });

    expect(result.data).toEqual({ ok: true });
    expect(attempts).toBe(3);
  });
});
