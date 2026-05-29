import { collectionTargets } from "../config/markets.js";
import { getAdapter } from "../exchanges/index.js";
import { fetchStandxListedSymbols } from "../exchanges/standx.js";
import { calculateExecutionMetrics } from "../metrics/orderbook.js";
import { BenchmarkDb } from "../storage/sqlite.js";

export interface CollectorOptions {
  dbPath: string;
  once: boolean;
  intervalSeconds: number;
}

export async function runCollectionRound(db: BenchmarkDb): Promise<{ collected: number; failed: number; notListed: number }> {
  db.initialize();
  const standxSymbols = await fetchStandxListedSymbols().catch(() => new Set<string>());
  let collected = 0;
  let failed = 0;
  let notListed = 0;

  for (const target of collectionTargets) {
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
      notListed += 1;
      continue;
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
      collected += 1;
    } catch (error) {
      failed += 1;
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
    }
  }

  return { collected, failed, notListed };
}

export async function runCollector(options: CollectorOptions): Promise<void> {
  const db = new BenchmarkDb(options.dbPath);
  db.initialize();
  try {
    while (true) {
      const result = await runCollectionRound(db);
      console.log(`collected=${result.collected} failed=${result.failed} not_listed=${result.notListed}`);
      if (options.once) break;
      await new Promise((resolve) => setTimeout(resolve, options.intervalSeconds * 1000));
    }
  } finally {
    db.close();
  }
}
