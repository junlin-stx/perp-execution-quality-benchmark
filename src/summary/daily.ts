import { markets, type Market, type Venue } from "../config/markets.js";
import { BenchmarkDb } from "../storage/sqlite.js";

export interface DailyVenueMetric {
  venue: Venue;
  market: Market;
  medianSlippageBp: number | null;
  status: "listed" | "not_listed" | "insufficient_depth";
}

const venueLabels: Record<Venue, string> = {
  hyperliquid: "Hyperliquid",
  binance_perps: "Binance Perps",
  aevo: "Aevo",
  standx: "StandX"
};

export function buildDailySummaryText(_utcDate: string, market: Market, rows: DailyVenueMetric[]): string {
  const listed = rows
    .filter((row) => row.status === "listed" && row.medianSlippageBp !== null)
    .sort((a, b) => Number(a.medianSlippageBp) - Number(b.medianSlippageBp));
  const notListed = rows.filter((row) => row.status === "not_listed");
  const parts: string[] = [];

  if (listed.length > 0) {
    const best = listed[0];
    const bestValue = Number(best.medianSlippageBp);
    const comparisons = listed.slice(1).map((row) => {
      const delta = Number(row.medianSlippageBp) - bestValue;
      return `${venueLabels[row.venue]} +${delta.toFixed(2)} bp`;
    });
    parts.push(`Yesterday ${market} 100k taker execution: ${venueLabels[best.venue]} best at ${bestValue.toFixed(2)} bp${comparisons.length ? `, ${comparisons.join(", ")}` : ""}.`);
  } else {
    parts.push(`Yesterday ${market} 100k taker execution: no listed venue had enough valid public samples.`);
  }

  for (const row of notListed) {
    parts.push(`${venueLabels[row.venue]} ${row.market} was not listed in the public ${venueLabels[row.venue]} perps symbol list during the UTC day.`);
  }

  return parts.join(" ");
}

export function generateDailySummaries(db: BenchmarkDb, utcDate: string): string[] {
  const raw = db.getRawDatabase();
  const startMs = Date.parse(`${utcDate}T00:00:00.000Z`);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const summaries: string[] = [];

  for (const market of markets) {
    const rows = raw.prepare(`
      select venue, market, avg(avg_slippage_100k_bp) as medianSlippageBp, 'listed' as status
      from execution_metrics
      where market = ?
        and local_timestamp_ms >= ?
        and local_timestamp_ms < ?
        and avg_slippage_100k_bp is not null
        and insufficient_depth_100k = 0
      group by venue, market
      union all
      select venue, market, null as medianSlippageBp, status
      from venue_market_status
      where market = ? and status = 'not_listed'
    `).all(market, startMs, endMs, market) as unknown as DailyVenueMetric[];
    const text = buildDailySummaryText(utcDate, market, rows);
    db.upsertDailySummary(utcDate, market, text);
    summaries.push(text);
  }

  return summaries;
}
