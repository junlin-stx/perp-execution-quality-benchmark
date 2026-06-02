import { collectionTargets } from "../config/markets.js";
import { getAdapter } from "../exchanges/index.js";
import { fetchStandxListedSymbols } from "../exchanges/standx.js";
import { calculateExecutionMetrics } from "../metrics/orderbook.js";
import { BenchmarkDb } from "../storage/sqlite.js";
import { mapWithConcurrency } from "./concurrency.js";

export type CollectionLogger = (line: string) => void;

export interface CollectorOptions {
  dbPath: string;
  once: boolean;
  intervalSeconds: number;
  concurrency?: number;
}

export interface CollectionRoundResult {
  collected: number;
  failed: number;
  notListed: number;
}

export interface CollectionRoundOptions {
  concurrency?: number;
  logger?: CollectionLogger;
}

export interface CollectionSuccessLogInput {
  venue: string;
  market: string;
  symbol: string;
  bidCount: number;
  askCount: number;
  latencyMs: number;
  spreadBp: number | null;
  depth3BpTotalUsd: number | null;
  depth5BpTotalUsd: number | null;
  depth10BpTotalUsd: number | null;
  avgSlippage100kBp: number | null;
  avgSlippage1mBp: number | null;
}

export function formatCollectionSuccessLog(input: CollectionSuccessLogInput): string {
  return [
    `[collect] ok venue=${input.venue}`,
    `market=${input.market}`,
    `symbol=${input.symbol}`,
    `bids=${input.bidCount}`,
    `asks=${input.askCount}`,
    `latency_ms=${input.latencyMs}`,
    `spread_bp=${formatMetric(input.spreadBp)}`,
    `depth_3bp_usd=${formatMetric(input.depth3BpTotalUsd, 0)}`,
    `depth_5bp_usd=${formatMetric(input.depth5BpTotalUsd, 0)}`,
    `depth_10bp_usd=${formatMetric(input.depth10BpTotalUsd, 0)}`,
    `slippage_100k_bp=${formatMetric(input.avgSlippage100kBp)}`,
    `slippage_1m_bp=${formatMetric(input.avgSlippage1mBp)}`
  ].join(" ");
}

export function formatCollectionDoneLog(input: CollectionRoundResult & { durationMs: number }): string {
  return `[collect] done collected=${input.collected} failed=${input.failed} not_listed=${input.notListed} duration_ms=${input.durationMs}`;
}

function formatMetric(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  const formatted = value.toFixed(digits);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/u, "") : formatted;
}

export async function runCollectionRound(db: BenchmarkDb, options: CollectionRoundOptions = {}): Promise<CollectionRoundResult> {
  const startedAtMs = Date.now();
  db.initialize();
  options.logger?.(`[collect] start targets=${collectionTargets.length} concurrency=${options.concurrency ?? 4}`);
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
      options.logger?.(`[collect] not_listed venue=${target.venue} market=${target.market} symbol=${target.symbol}`);
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
      const metrics = calculateExecutionMetrics(book);
      db.insertMetrics(snapshotId, metrics);
      options.logger?.(formatCollectionSuccessLog({
        venue: target.venue,
        market: target.market,
        symbol: target.symbol,
        bidCount: book.bids.length,
        askCount: book.asks.length,
        latencyMs: book.latencyMs,
        spreadBp: metrics.spreadBp,
        depth3BpTotalUsd: metrics.depth3BpTotalUsd,
        depth5BpTotalUsd: metrics.depth5BpTotalUsd,
        depth10BpTotalUsd: metrics.depth10BpTotalUsd,
        avgSlippage100kBp: metrics.avgSlippage100kBp,
        avgSlippage1mBp: metrics.avgSlippage1mBp
      }));
      return "collected";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
        error: message
      });
      options.logger?.(`[collect] failed venue=${target.venue} market=${target.market} symbol=${target.symbol} error=${JSON.stringify(message)}`);
      return "failed";
    }
  });

  const result = {
    collected: results.filter((result) => result === "collected").length,
    failed: results.filter((result) => result === "failed").length,
    notListed: results.filter((result) => result === "not_listed").length
  };
  options.logger?.(formatCollectionDoneLog({ ...result, durationMs: Date.now() - startedAtMs }));
  return result;
}

export async function runCollector(options: CollectorOptions): Promise<void> {
  const db = new BenchmarkDb(options.dbPath);
  db.initialize();
  try {
    while (true) {
      await runCollectionRound(db, { concurrency: options.concurrency, logger: console.log });
      if (options.once) break;
      await new Promise((resolve) => setTimeout(resolve, options.intervalSeconds * 1000));
    }
  } finally {
    db.close();
  }
}
