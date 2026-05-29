import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Market, Venue, VenueMarketStatus } from "../config/markets.js";
import type { ExecutionMetrics } from "../types/orderbook.js";

export interface VenueMarketStatusRow {
  venue: Venue;
  market: Market;
  symbol: string;
  status: VenueMarketStatus;
  reason: string | null;
}

export interface SnapshotInsert {
  venue: Venue;
  market: Market;
  symbol: string;
  source: string;
  localTimestampMs: number;
  sourceTimestampMs: number | null;
  latencyMs: number;
  bidCount: number;
  askCount: number;
  isPartial: boolean;
  status: "ok" | "failed" | "not_listed";
  error: string | null;
}

export class BenchmarkDb {
  private db: DatabaseSync;

  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
  }

  initialize(): void {
    this.db.exec(`
      create table if not exists venue_market_status (
        venue text not null,
        market text not null,
        symbol text not null,
        status text not null,
        reason text,
        updated_at_ms integer not null,
        primary key (venue, market)
      );
      create table if not exists orderbook_snapshots (
        id integer primary key autoincrement,
        venue text not null,
        market text not null,
        symbol text not null,
        source text not null,
        local_timestamp_ms integer not null,
        source_timestamp_ms integer,
        latency_ms integer not null,
        bid_count integer not null,
        ask_count integer not null,
        is_partial integer not null,
        status text not null,
        error text
      );
      create table if not exists execution_metrics (
        snapshot_id integer primary key,
        venue text not null,
        market text not null,
        symbol text not null,
        local_timestamp_ms integer not null,
        mid_price real,
        spread_bp real,
        depth_3bp_bid_usd real,
        depth_3bp_ask_usd real,
        depth_3bp_total_usd real,
        depth_5bp_bid_usd real,
        depth_5bp_ask_usd real,
        depth_5bp_total_usd real,
        depth_10bp_bid_usd real,
        depth_10bp_ask_usd real,
        depth_10bp_total_usd real,
        buy_slippage_100k_bp real,
        sell_slippage_100k_bp real,
        avg_slippage_100k_bp real,
        insufficient_depth_100k integer not null,
        buy_slippage_1m_bp real,
        sell_slippage_1m_bp real,
        avg_slippage_1m_bp real,
        insufficient_depth_1m integer not null default 0,
        valid integer not null,
        error text,
        foreign key (snapshot_id) references orderbook_snapshots(id)
      );
      create table if not exists daily_summaries (
        utc_date text not null,
        market text not null,
        summary text not null,
        created_at_ms integer not null,
        primary key (utc_date, market)
      );
      create table if not exists anomaly_events (
        dedupe_key text primary key,
        venue text not null,
        market text not null,
        metric text not null,
        message text not null,
        start_timestamp_ms integer not null,
        end_timestamp_ms integer not null,
        created_at_ms integer not null
      );
    `);
    this.ensureExecutionMetricColumn("depth_3bp_bid_usd", "real");
    this.ensureExecutionMetricColumn("depth_3bp_ask_usd", "real");
    this.ensureExecutionMetricColumn("depth_3bp_total_usd", "real");
    this.ensureExecutionMetricColumn("depth_5bp_bid_usd", "real");
    this.ensureExecutionMetricColumn("depth_5bp_ask_usd", "real");
    this.ensureExecutionMetricColumn("depth_5bp_total_usd", "real");
    this.ensureExecutionMetricColumn("buy_slippage_1m_bp", "real");
    this.ensureExecutionMetricColumn("sell_slippage_1m_bp", "real");
    this.ensureExecutionMetricColumn("avg_slippage_1m_bp", "real");
    this.ensureExecutionMetricColumn("insufficient_depth_1m", "integer not null default 0");
  }

  private ensureExecutionMetricColumn(name: string, definition: string): void {
    const columns = this.db.prepare("pragma table_info(execution_metrics)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === name)) {
      this.db.exec(`alter table execution_metrics add column ${name} ${definition}`);
    }
  }

  upsertVenueMarketStatus(row: VenueMarketStatusRow): void {
    this.db.prepare(`
      insert into venue_market_status (venue, market, symbol, status, reason, updated_at_ms)
      values (?, ?, ?, ?, ?, ?)
      on conflict(venue, market) do update set
        symbol = excluded.symbol,
        status = excluded.status,
        reason = excluded.reason,
        updated_at_ms = excluded.updated_at_ms
    `).run(row.venue, row.market, row.symbol, row.status, row.reason, Date.now());
  }

  insertSnapshot(row: SnapshotInsert): number {
    const result = this.db.prepare(`
      insert into orderbook_snapshots (
        venue, market, symbol, source, local_timestamp_ms, source_timestamp_ms, latency_ms,
        bid_count, ask_count, is_partial, status, error
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.venue,
      row.market,
      row.symbol,
      row.source,
      row.localTimestampMs,
      row.sourceTimestampMs,
      row.latencyMs,
      row.bidCount,
      row.askCount,
      row.isPartial ? 1 : 0,
      row.status,
      row.error
    );
    return Number(result.lastInsertRowid);
  }

  insertMetrics(snapshotId: number, metrics: ExecutionMetrics): void {
    this.db.prepare(`
      insert into execution_metrics (
        snapshot_id, venue, market, symbol, local_timestamp_ms, mid_price, spread_bp,
        depth_3bp_bid_usd, depth_3bp_ask_usd, depth_3bp_total_usd,
        depth_5bp_bid_usd, depth_5bp_ask_usd, depth_5bp_total_usd,
        depth_10bp_bid_usd, depth_10bp_ask_usd, depth_10bp_total_usd,
        buy_slippage_100k_bp, sell_slippage_100k_bp, avg_slippage_100k_bp,
        insufficient_depth_100k, buy_slippage_1m_bp, sell_slippage_1m_bp,
        avg_slippage_1m_bp, insufficient_depth_1m, valid, error
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshotId,
      metrics.venue,
      metrics.market,
      metrics.symbol,
      metrics.localTimestampMs,
      metrics.midPrice,
      metrics.spreadBp,
      metrics.depth3BpBidUsd,
      metrics.depth3BpAskUsd,
      metrics.depth3BpTotalUsd,
      metrics.depth5BpBidUsd,
      metrics.depth5BpAskUsd,
      metrics.depth5BpTotalUsd,
      metrics.depth10BpBidUsd,
      metrics.depth10BpAskUsd,
      metrics.depth10BpTotalUsd,
      metrics.buySlippage100kBp,
      metrics.sellSlippage100kBp,
      metrics.avgSlippage100kBp,
      metrics.insufficientDepth100k ? 1 : 0,
      metrics.buySlippage1mBp,
      metrics.sellSlippage1mBp,
      metrics.avgSlippage1mBp,
      metrics.insufficientDepth1m ? 1 : 0,
      metrics.valid ? 1 : 0,
      metrics.error
    );
  }

  getLatestGrid(): unknown[] {
    return this.db.prepare(`
      select venue, market, symbol, status, reason, null as spread_bp, null as depth_3bp_total_usd, null as depth_5bp_total_usd, null as depth_10bp_total_usd, null as avg_slippage_100k_bp, null as avg_slippage_1m_bp
      from venue_market_status
      union all
      select venue, market, symbol, 'listed' as status, null as reason, spread_bp, depth_3bp_total_usd, depth_5bp_total_usd, depth_10bp_total_usd, avg_slippage_100k_bp, avg_slippage_1m_bp
      from execution_metrics
      where snapshot_id in (select max(snapshot_id) from execution_metrics group by venue, market)
    `).all();
  }

  getHistorySince(sinceMs: number): unknown[] {
    return this.db.prepare(`
      select * from execution_metrics
      where local_timestamp_ms >= ?
      order by local_timestamp_ms asc
    `).all(sinceMs);
  }

  getRecentAnomalies(): unknown[] {
    return this.db.prepare("select * from anomaly_events order by created_at_ms desc limit 100").all();
  }

  upsertDailySummary(utcDate: string, market: Market, summary: string): void {
    this.db.prepare(`
      insert into daily_summaries (utc_date, market, summary, created_at_ms)
      values (?, ?, ?, ?)
      on conflict(utc_date, market) do update set
        summary = excluded.summary,
        created_at_ms = excluded.created_at_ms
    `).run(utcDate, market, summary, Date.now());
  }

  getDailySummaries(): unknown[] {
    return this.db.prepare("select * from daily_summaries order by utc_date desc, market asc limit 30").all();
  }

  getRawDatabase(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
