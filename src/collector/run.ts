import { collectionTargets } from "../config/markets.js";
import { getAdapter } from "../exchanges/index.js";
import { fetchStandxListedSymbols } from "../exchanges/standx.js";
import { calculateExecutionMetrics } from "../metrics/orderbook.js";
import { BenchmarkDb } from "../storage/sqlite.js";
import { mapWithConcurrency } from "./concurrency.js";

export interface CollectorOptions {
  dbPath: string;
  once: boolean;
  intervalSeconds: number;
  concurrency?: number;
}

export async function runCollectionRound(db: BenchmarkDb, options: { concurrency?: number } = {}): Promise<{ collected: number; failed: number; notListed: number }> {
  db.initialize();
  const standxSymbols = await fetchStandxListedSymbols().catch(() => new Set<string>());
  const concurrency = options.concurrency ?? 4;

  const results = await mapWithConcurrency(collectionTargets, concurrency, async (target) => {
    if (target.status === "not_listed" || (target.venue === "standx" && !standxSymbols.has(target.symbol))) {
      db.upsertVenueMarketStatus({
        venue: target.venue,
        market: target.market,
        symbol: target.symbol,
        status: "not_listed",
        reason: target.venue === "standx" ? "not in StandX public symbol list" : "not listed"
      });
      db.insertSnapshot({
        venue: target.venue,
        market: target.market,
        symbol: target.symbol,
        source: target.source,
        localTimestampMs: Date.now(),
        sourceTimestampMs: null,
        latencyMs: 0,
        bidCount: 0,
        askCount: 0,
        isPartial: false,
        status: "not_listed",
        error: "not_listed"
      });
      return "not_listed";
    }

    try {
      db.upsertVenueMarketStatus({ venue: target.venue, market: target.market, symbol: target.symbol, status: "listed", reason: null });
      const book = await getAdapter(target.venue).fetchOrderBook(target);
      const snapshotId = db.insertSnapshot({
        venue: target.venue,
        market: target.market,
        symbol: target.symbol,
        source: book.source,
        localTimestampMs: book.localTimestampMs,
        sourceTimestampMs: book.sourceTimestampMs ?? null,
        latencyMs: book.latencyMs,
        bidCount: book.bids.length,
        askCount: book.asks.length,
        isPartial: book.isPartial,
        status: "ok",
        error: null
      });
      db.insertMetrics(snapshotId, calculateExecutionMetrics(book));
      return "collected";
    } catch (error) {
      db.insertSnapshot({
        venue: target.venue,
        market: target.market,
        symbol: target.symbol,
        source: target.source,
        localTimestampMs: Date.now(),
        sourceTimestampMs: null,
        latencyMs: 0,
        bidCount: 0,
        askCount: 0,
        isPartial: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      return "failed";
    }
  });

  return {
    collected: results.filter((result) => result === "collected").length,
    failed: results.filter((result) => result === "failed").length,
    notListed: results.filter((result) => result === "not_listed").length
  };
}

export async function runCollector(options: CollectorOptions): Promise<void> {
  const db = new BenchmarkDb(options.dbPath);
  db.initialize();
  try {
    while (true) {
      const result = await runCollectionRound(db, { concurrency: options.concurrency });
      console.log(`collected=${result.collected} failed=${result.failed} not_listed=${result.notListed}`);
      if (options.once) break;
      await new Promise((resolve) => setTimeout(resolve, options.intervalSeconds * 1000));
    }
  } finally {
    db.close();
  }
}
