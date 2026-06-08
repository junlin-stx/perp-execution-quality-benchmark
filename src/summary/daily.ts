import { benchmarkVenues, markets, referenceVenues, type Market, type Venue } from "../config/markets.js";
import { BenchmarkDb } from "../storage/sqlite.js";

export interface DailyVenueMetric {
  venue: Venue;
  market: Market;
  medianSlippageBp: number | null;
  status: "listed" | "not_listed" | "insufficient_depth";
}

const venueLabels: Record<Venue, string> = {
  hyperliquid: "Hyperliquid",
  standx: "StandX",
  aster: "Aster",
  edgex: "edgeX",
  grvt: "GRVT",
  lighter: "Lighter",
  extended: "Extended",
  nado: "Nado"
};

const benchmarkVenueSet = new Set<Venue>(benchmarkVenues);
const referenceVenueSet = new Set<Venue>(referenceVenues);

export function buildDailySummaryText(_utcDate: string, market: Market, rows: DailyVenueMetric[]): string {
  const listed = rows
    .filter((row) => row.status === "listed" && row.medianSlippageBp !== null && benchmarkVenueSet.has(row.venue))
    .sort((a, b) => Number(a.medianSlippageBp) - Number(b.medianSlippageBp));
  const references = rows
    .filter((row) => row.status === "listed" && row.medianSlippageBp !== null && referenceVenueSet.has(row.venue))
    .sort((a, b) => Number(a.medianSlippageBp) - Number(b.medianSlippageBp));
  const notListed = rows.filter((row) => row.status === "not_listed");
  const insufficientDepth = rows.filter((row) => row.status === "insufficient_depth");
  const parts: string[] = [];

  if (listed.length > 0) {
    const best = listed[0];
    const bestValue = Number(best.medianSlippageBp);
    const comparisons = listed.slice(1).map((row) => {
      const delta = Number(row.medianSlippageBp) - bestValue;
      return `${venueLabels[row.venue]} was +${delta.toFixed(2)} bp vs ${venueLabels[best.venue]}`;
    });
    parts.push(`${_utcDate} ${market} execution-quality note: ${venueLabels[best.venue]} led benchmark venues at ${bestValue.toFixed(2)} bp median 100k taker slippage${comparisons.length ? `; ${comparisons.join("; ")}` : ""}.`);
  } else {
    parts.push(`${_utcDate} ${market} execution-quality note: no benchmark venue had enough valid public 100k taker slippage samples.`);
  }

  if (references.length > 0) {
    parts.push(`Reference only: ${references.map((row) => `${venueLabels[row.venue]} ${Number(row.medianSlippageBp).toFixed(2)} bp`).join(", ")}.`);
  }

  for (const row of notListed) {
    parts.push(`${venueLabels[row.venue]} ${row.market} was not listed in the public ${venueLabels[row.venue]} perps symbol list during the UTC day.`);
  }

  if (insufficientDepth.length > 0) {
    parts.push(`Insufficient public depth: ${insufficientDepth.map((row) => venueLabels[row.venue]).join(", ")}.`);
  }

  return parts.join(" ");
}

export function generateDailySummaries(db: BenchmarkDb, utcDate: string): string[] {
  const raw = db.getRawDatabase();
  const startMs = Date.parse(`${utcDate}T00:00:00.000Z`);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const summaries: string[] = [];

  for (const market of markets) {
    const metricRows = raw.prepare(`
      select venue, market, avg_slippage_100k_bp as slippage
      from execution_metrics
      where market = ?
        and local_timestamp_ms >= ?
        and local_timestamp_ms < ?
        and avg_slippage_100k_bp is not null
        and insufficient_depth_100k = 0
    `).all(market, startMs, endMs) as unknown as Array<{ venue: Venue; market: Market; slippage: number }>;
    const listedRows = [...groupByVenue(metricRows).entries()].map(([venue, values]) => ({
      venue,
      market,
      medianSlippageBp: median(values),
      status: "listed" as const
    }));
    const notListedRows = raw.prepare(`
      select venue, market, null as medianSlippageBp, status
      from venue_market_status
      where market = ? and status = 'not_listed'
    `).all(market) as unknown as DailyVenueMetric[];
    const insufficientRows = raw.prepare(`
      select venue, market, null as medianSlippageBp, 'insufficient_depth' as status
      from execution_metrics
      where market = ?
        and local_timestamp_ms >= ?
        and local_timestamp_ms < ?
        and valid = 0
        and (insufficient_depth_100k = 1 or insufficient_depth_1m = 1)
      group by venue, market
    `).all(market, startMs, endMs) as unknown as DailyVenueMetric[];
    const rows = [...listedRows, ...notListedRows, ...insufficientRows];
    const text = buildDailySummaryText(utcDate, market, rows);
    db.upsertDailySummary(utcDate, market, text);
    summaries.push(text);
  }

  return summaries;
}

function groupByVenue(rows: Array<{ venue: Venue; slippage: number }>): Map<Venue, number[]> {
  const grouped = new Map<Venue, number[]>();
  for (const row of rows) {
    grouped.set(row.venue, [...(grouped.get(row.venue) ?? []), row.slippage]);
  }
  return grouped;
}

function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
