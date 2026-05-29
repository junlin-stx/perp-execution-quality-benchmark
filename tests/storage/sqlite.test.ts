import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BenchmarkDb } from "../../src/storage/sqlite.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("BenchmarkDb", () => {
  it("creates schema, stores status, snapshots, and metrics", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-bench-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    db.upsertVenueMarketStatus({ venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", reason: "not in symbol list" });
    const snapshotId = db.insertSnapshot({
      venue: "hyperliquid",
      market: "BTC",
      symbol: "BTC",
      source: "hyperliquid_l2_book",
      localTimestampMs: 1,
      sourceTimestampMs: 2,
      latencyMs: 10,
      bidCount: 2,
      askCount: 2,
      isPartial: false,
      status: "ok",
      error: null
    });
    db.insertMetrics(snapshotId, {
      venue: "hyperliquid",
      market: "BTC",
      symbol: "BTC",
      localTimestampMs: 1,
      midPrice: 100,
      spreadBp: 1,
      depth10BpBidUsd: 1000,
      depth10BpAskUsd: 900,
      depth10BpTotalUsd: 1900,
      buySlippage100kBp: 2,
      sellSlippage100kBp: 3,
      avgSlippage100kBp: 2.5,
      insufficientDepth100k: false,
      valid: true,
      error: null
    });
    expect(db.getLatestGrid()).toHaveLength(2);
    db.close();
  });
});
