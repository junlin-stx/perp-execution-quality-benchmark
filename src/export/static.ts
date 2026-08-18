import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { benchmarkVenues, collectionTargets, markets, referenceVenues, venues } from "../config/markets.js";
import { BenchmarkDb } from "../storage/sqlite.js";

export interface StaticSiteOptions {
  dataBaseUrl?: string;
  nowMs?: number;
}

export function exportStaticSite(db: BenchmarkDb, outputDir = "public", options: StaticSiteOptions = {}): void {
  exportLatestData(db, outputDir);
  exportHealthData(db, outputDir, { nowMs: options.nowMs });
  exportHistoryData(db, outputDir);
  exportSummaryData(db, outputDir);
  writeFileSync(join(outputDir, "index.html"), indexHtml(options), "utf8");
  writeFileSync(join(outputDir, "methodology.html"), methodologyHtml(), "utf8");
}

export function exportLatestData(db: BenchmarkDb, outputDir = "public"): void {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });
  const activeVenues = new Set<string>(venues);
  const latest = {
    generatedAt: new Date().toISOString(),
    targets: collectionTargets,
    rows: filterActiveVenueRows(db.getLatestGrid(), activeVenues)
  };
  writeJson(join(dataDir, "latest.json"), latest);
}

export function exportHealthData(db: BenchmarkDb, outputDir = "public", options: { nowMs?: number } = {}): void {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });
  const nowMs = options.nowMs ?? Date.now();
  const activeVenues = new Set<string>(venues);
  const latestRows = db.getLatestSnapshotStatuses().filter((row) => activeVenues.has(row.venue));
  const latestMap = new Map(latestRows.map((row) => [`${row.venue}:${row.market}`, row]));
  const statuses = collectionTargets.map((target) => {
    const row = latestMap.get(`${target.venue}:${target.market}`);
    const status = target.status === "not_listed" ? "not_listed" : (row?.status ?? "unavailable");
    const insufficient = row ? row.insufficient_depth_100k === 1 || row.insufficient_depth_1m === 1 || row.valid === 0 : false;
    return {
      venue: target.venue,
      market: target.market,
      symbol: row?.symbol ?? target.symbol,
      status: insufficient && status === "ok" ? "insufficient_depth" : status,
      reason: target.status === "not_listed" ? "configured not listed" : (row?.reason ?? (row ? null : "no recent sample")),
      local_timestamp_ms: row?.local_timestamp_ms ?? null,
      latest_sample_age_seconds: row ? Math.max(0, Math.floor((nowMs - row.local_timestamp_ms) / 1000)) : null
    };
  });
  const latestSampleTimestampMs = latestRows.length ? Math.max(...latestRows.map((row) => row.local_timestamp_ms)) : null;
  const health = {
    schemaVersion: 2,
    generatedAt: new Date(nowMs).toISOString(),
    latestSampleTimestampMs,
    latestSampleAgeSeconds: latestSampleTimestampMs === null ? null : Math.max(0, Math.floor((nowMs - latestSampleTimestampMs) / 1000)),
    expectedTargetCount: collectionTargets.length,
    expectedListedCount: collectionTargets.filter((target) => target.status === "listed").length,
    validSampleCount: latestRows.filter((row) => row.valid === 1).length,
    failedCount: statuses.filter((row) => row.status === "failed").length,
    notListedCount: statuses.filter((row) => row.status === "not_listed").length,
    insufficientDepthCount: statuses.filter((row) => row.status === "insufficient_depth").length,
    unavailableCount: statuses.filter((row) => row.status === "unavailable").length,
    referenceVenues,
    benchmarkVenues,
    statuses
  };
  writeJson(join(dataDir, "health.json"), health);
}

export function exportHistoryData(db: BenchmarkDb, outputDir = "public", options: { nowMs?: number; bucketMs?: number } = {}): void {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });
  const activeVenues = new Set<string>(venues);
  const nowMs = options.nowMs ?? Date.now();
  const bucketMs = options.bucketMs ?? 15 * 60 * 1000;
  const history = rollupHistory(
    filterActiveVenueRows(db.getHistorySince(nowMs - 7 * 24 * 60 * 60 * 1000), activeVenues),
    bucketMs
  );
  writeJson(join(dataDir, "history-7d.json"), history);
}

export function exportSummaryData(db: BenchmarkDb, outputDir = "public"): void {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });
  const activeVenues = new Set<string>(venues);
  const summaries = filterRemovedVenueSummaries(db.getDailySummaries());
  const anomalies = filterActiveVenueRows(db.getRecentAnomalies(), activeVenues);
  writeJson(join(dataDir, "daily-summary.json"), summaries);
  writeJson(join(dataDir, "anomalies.json"), anomalies);
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function filterActiveVenueRows(rows: unknown[], activeVenues: Set<string>): unknown[] {
  return rows.filter((row) => {
    const venue = (row as { venue?: unknown }).venue;
    return typeof venue !== "string" || activeVenues.has(venue);
  });
}

function filterRemovedVenueSummaries(rows: unknown[]): unknown[] {
  return rows.filter((row) => {
    const summary = (row as { summary?: unknown }).summary;
    return typeof summary !== "string" || !summary.includes("Aevo");
  });
}

function rollupHistory(rows: unknown[], bucketMs: number): unknown[] {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const item = row as Record<string, unknown>;
    const timestamp = numericValue(item.local_timestamp_ms);
    const venue = item.venue;
    const market = item.market;
    if (timestamp === null || typeof venue !== "string" || typeof market !== "string") continue;
    const bucketStartMs = Math.floor(timestamp / bucketMs) * bucketMs;
    const key = `${bucketStartMs}:${venue}:${market}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()].map(([key, group]) => {
    const [bucketStartMs, venue, market] = key.split(":");
    const first = group[0];
    return {
      bucket_start_ms: Number(bucketStartMs),
      local_timestamp_ms: Number(bucketStartMs),
      venue,
      market,
      symbol: first.symbol ?? null,
      sample_count: group.length,
      spread_bp: median(group.map((row) => numericValue(row.spread_bp))),
      depth_3bp_total_usd: median(group.map((row) => numericValue(row.depth_3bp_total_usd))),
      depth_5bp_total_usd: median(group.map((row) => numericValue(row.depth_5bp_total_usd))),
      depth_10bp_total_usd: median(group.map((row) => numericValue(row.depth_10bp_total_usd))),
      avg_slippage_100k_bp: median(group.map((row) => numericValue(row.avg_slippage_100k_bp))),
      avg_slippage_1m_bp: median(group.map((row) => numericValue(row.avg_slippage_1m_bp))),
      insufficient_depth_100k_count: group.filter((row) => row.insufficient_depth_100k === 1).length,
      insufficient_depth_1m_count: group.filter((row) => row.insufficient_depth_1m === 1).length,
      invalid_count: group.filter((row) => row.valid === 0).length,
      valid: group.some((row) => row.valid !== 0) ? 1 : 0
    };
  }).sort((a, b) => {
    const left = a as { local_timestamp_ms: number; venue: string; market: string };
    const right = b as { local_timestamp_ms: number; venue: string; market: string };
    return left.local_timestamp_ms - right.local_timestamp_ms || left.market.localeCompare(right.market) || left.venue.localeCompare(right.venue);
  });
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function median(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function indexHtml(options: StaticSiteOptions = {}): string {
  const dataBaseUrl = options.dataBaseUrl?.replace(/\/+$/g, "") ?? "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Perp Execution Quality Benchmark</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18232e; background: #f8f6f1; --ink: #18232e; --muted: #65717d; --teal: #075665; --teal-dark: #064b58; --line: #ded9cf; --line-soft: #ebe7df; --paper: #ffffff; --best: #0d6b4f; --best-soft: #eef8f3; --reference: #365f6b; --reference-soft: #f1f6f7; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8f6f1; }
    header { background: #ffffff; border-bottom: 1px solid var(--line); }
    .header-inner { display: flex; justify-content: space-between; gap: 32px; max-width: 1440px; margin: 0 auto; padding: 22px 32px 18px; }
    .header-copy { max-width: 920px; }
    .header-meta { display: grid; justify-items: end; gap: 14px; min-width: 300px; }
    h1 { margin: 0 0 7px; font-size: 27px; line-height: 1.18; letter-spacing: -0.02em; }
    h2 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
    h3 { margin: 0; }
    p { margin: 0; line-height: 1.48; color: #4c5965; }
    main { padding: 0 32px 44px; max-width: 1440px; margin: 0 auto; }
    section { scroll-margin-top: 64px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line-soft); text-align: left; font-size: 14px; vertical-align: top; }
    th { color: #59636d; font-size: 11px; font-weight: 750; letter-spacing: 0.03em; text-transform: uppercase; }
    .muted { color: var(--muted); }
    .nav-links { display: flex; gap: 16px; flex-wrap: wrap; justify-content: flex-end; }
    a { color: #075d66; text-underline-offset: 2px; }
    a:hover { color: #023e45; }
    a:focus-visible, button:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid rgba(13,107,79,.3); outline-offset: 2px; }
    .primary-section { margin: 0; }
    .market-toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: stretch; justify-content: space-between; gap: 20px; min-height: 50px; background: rgba(248,246,241,.97); border-bottom: 1px solid var(--line); }
    .market-tabs { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); width: min(620px, 70%); }
    .market-tab { appearance: none; border: 0; border-bottom: 3px solid transparent; padding: 14px 18px 11px; background: transparent; color: #25313d; font: inherit; font-weight: 750; cursor: pointer; }
    .market-tab:hover { background: #f1eee7; }
    .market-tab[aria-selected="true"] { border-bottom-color: #087080; color: #064b58; }
    .market-live { align-self: center; color: #34414d; font-size: 13px; font-weight: 650; white-space: nowrap; }
    .market-live::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--best); vertical-align: 1px; }
    .comparison-grid { padding-top: 12px; }
    .market-panel { min-width: 0; overflow-x: auto; background: var(--paper); border: 1px solid var(--line); }
    .market-panel h3 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .market-panel thead { background: var(--teal); }
    .market-panel thead th { position: sticky; top: 0; z-index: 3; background: var(--teal); color: #ffffff; border-bottom-color: var(--teal-dark); }
    .market-panel th:nth-child(n+3), .market-panel td:nth-child(n+3) { text-align: right; }
    .market-panel tbody tr:last-child td { border-bottom: 0; }
    .group-row th { padding: 8px 12px; background: #f4f3ef; color: #52606c; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); text-align: left !important; }
    .venue-name { font-weight: 750; white-space: nowrap; }
    .status { font-weight: 650; white-space: nowrap; }
    .metric-value { display: block; font-variant-numeric: tabular-nums; font-weight: 720; white-space: nowrap; }
    .metric-note { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; line-height: 1.25; }
    .best-cell { background: var(--best-soft); }
    .best-badge, .reference-badge { display: inline-block; margin-left: 6px; padding: 1px 5px; border-radius: 3px; color: #ffffff; font-size: 10px; font-weight: 800; vertical-align: 1px; }
    .best-badge { background: var(--best); }
    .reference-badge { background: var(--reference); }
    .reference-row { background: var(--reference-soft); }
    .na-row { color: var(--muted); background: #faf9f6; }
    .method-note { padding: 8px 2px 0; font-size: 12px; color: #728090; }
    .health-section { margin-top: 18px; background: var(--paper); border: 1px solid var(--line); }
    .health-layout { display: grid; grid-template-columns: minmax(360px, .75fr) minmax(520px, 1.25fr); }
    .health-overview { padding: 14px 16px; border-right: 1px solid var(--line); }
    .health-overview h2 { margin-bottom: 12px; font-size: 18px; }
    .health-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .health-item { min-width: 0; padding: 2px 16px; border-left: 1px solid var(--line-soft); }
    .health-item:first-child { padding-left: 0; border-left: 0; }
    .health-item span { display: block; color: var(--muted); font-size: 10px; font-weight: 750; letter-spacing: .03em; text-transform: uppercase; }
    .health-item strong { display: block; margin-top: 4px; font-size: 18px; font-variant-numeric: tabular-nums; }
    .health-detail { min-width: 0; padding: 12px 16px; }
    .health-detail-title { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; margin-bottom: 6px; }
    .health-detail-title strong { font-size: 13px; }
    .attention-wrap { overflow-x: auto; }
    .attention-table th, .attention-table td { padding: 5px 8px; font-size: 12px; }
    .attention-table th { font-size: 10px; }
    details { border-top: 1px solid var(--line-soft); margin-top: 8px; padding-top: 8px; }
    summary { width: max-content; margin-left: auto; color: #075d66; font-size: 13px; font-weight: 700; cursor: pointer; }
    .status-table-wrap { max-height: 360px; margin-top: 10px; overflow: auto; border: 1px solid var(--line); }
    .status-table-wrap th { position: sticky; top: 0; background: #f5f3ee; }
    .status-table-wrap th, .status-table-wrap td { padding: 7px 9px; font-size: 12px; }
    .drilldown-section { margin-top: 26px; }
    .section-heading { display: flex; justify-content: space-between; gap: 22px; align-items: end; margin-bottom: 10px; }
    .section-heading h2 { margin-bottom: 3px; }
    .control-row { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; }
    .control { display: grid; gap: 4px; min-width: 180px; color: #59636d; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    select { min-height: 36px; padding: 7px 32px 7px 10px; border: 1px solid #c9c0b0; background: #ffffff; color: var(--ink); font: inherit; }
    .history-panel { background: var(--paper); border: 1px solid var(--line); padding: 12px 14px; }
    .history-panel h3 { margin-bottom: 10px; font-size: 15px; }
    .history-panel dl { display: grid; grid-template-columns: repeat(10, minmax(95px, 1fr)); margin: 0; }
    .history-stat { min-width: 0; padding: 2px 12px; border-left: 1px solid var(--line-soft); }
    .history-stat:first-child { padding-left: 0; border-left: 0; }
    .history-panel dt { color: var(--muted); font-size: 10px; line-height: 1.25; }
    .history-panel dd { margin: 4px 0 0; font-size: 14px; font-weight: 720; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 24px; }
    .insight-panel { min-width: 0; background: var(--paper); border: 1px solid var(--line); padding: 14px 16px; }
    .insight-panel h2 { margin-bottom: 6px; font-size: 17px; }
    .summary-list, .anomaly-list { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 7px; }
    .summary-list li, .anomaly-list li { border-top: 1px solid var(--line-soft); padding: 8px 0 0; line-height: 1.45; }
    @media (max-width: 980px) {
      .header-inner { display: grid; }
      .header-meta { justify-items: start; min-width: 0; }
      .nav-links { justify-content: flex-start; }
      .health-layout { grid-template-columns: 1fr; }
      .health-overview { border-right: 0; border-bottom: 1px solid var(--line); }
      .history-panel { overflow-x: auto; }
      .history-panel dl { min-width: 1050px; }
    }
    @media (max-width: 820px) {
      .header-inner { gap: 16px; padding: 20px 18px 16px; }
      h1 { font-size: 25px; }
      main { padding: 0 18px 36px; }
      .market-toolbar { margin: 0 -18px; padding: 0 18px; display: block; }
      .market-tabs { width: 100%; grid-template-columns: repeat(4, 1fr); }
      .market-tab { min-width: 0; padding: 13px 6px 10px; }
      .market-live { display: block; padding: 8px 2px; border-top: 1px solid var(--line-soft); }
      .market-panel table, .market-panel tbody, .market-panel tr, .market-panel td { display: block; }
      .market-panel thead { display: none; }
      .market-panel tr:not(.group-row) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
      .market-panel tr.group-row { display: block; }
      .market-panel .group-row th { display: block; }
      .market-panel td, .market-panel th:nth-child(n+3), .market-panel td:nth-child(n+3) { min-width: 0; padding: 9px 10px; border-bottom: 0; text-align: left; font-size: 13px; }
      .market-panel td::before { content: attr(data-label); display: block; margin-bottom: 3px; color: var(--muted); font-size: 9px; font-weight: 750; letter-spacing: .03em; text-transform: uppercase; }
      .metric-value { white-space: normal; }
      .health-grid { grid-template-columns: repeat(3, 1fr); }
      .health-item { padding: 2px 8px; }
      .health-detail-title { display: grid; }
      summary { margin-left: 0; }
      .section-heading { display: grid; align-items: start; }
      .control-row { display: grid; grid-template-columns: 1fr 1fr; }
      .control { min-width: 0; }
      .history-panel dl { min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .history-stat { padding: 9px 8px; border-left: 0; border-top: 1px solid var(--line-soft); }
      .history-stat:nth-child(-n+2) { border-top: 0; }
      .insights-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="header-copy">
        <h1>Perp Execution Quality Benchmark</h1>
        <p>Open benchmark for spread, 10bp / 5bp / 3bp depth, and estimated 100,000 / 1,000,000 USD taker slippage across StandX, edgeX, GRVT, Lighter, Extended, and Nado, with Hyperliquid and Aster shown as reference venues.</p>
      </div>
      <div class="header-meta">
        <p class="muted" id="freshness" aria-live="polite">Loading latest data...</p>
        <nav class="nav-links" aria-label="Public benchmark links">
          <a href="methodology.html">Methodology</a>
          <a href="data/latest.json">latest.json</a>
          <a href="data/health.json">health.json</a>
        </nav>
      </div>
    </div>
  </header>
  <main>
    <section class="primary-section" aria-labelledby="comparison-title">
      <h2 id="comparison-title" hidden>Latest Comparison</h2>
      <div class="market-toolbar">
        <div class="market-tabs" id="market-tabs" role="tablist" aria-label="Benchmark market"></div>
        <div class="market-live" id="market-live" aria-live="polite">Loading benchmark status...</div>
      </div>
      <div class="comparison-grid" id="comparison"></div>
      <p class="method-note">Depths are shown in USD; slippage and spread are basis points (bp). Lower slippage is better. Spread is tick-size sensitive.</p>
    </section>
    <section class="health-section" aria-labelledby="health-title">
      <div class="health-layout">
        <div class="health-overview">
          <h2 id="health-title">Data Health</h2>
          <div class="health-grid" id="health-grid"></div>
        </div>
        <div class="health-detail">
          <div class="health-detail-title">
            <strong>Sample status by venue / market</strong>
            <span class="muted" id="health-note">Loading status summary...</span>
          </div>
          <div class="attention-wrap">
            <table class="attention-table">
              <thead><tr><th>Issue</th><th>Count</th><th>Examples</th></tr></thead>
              <tbody id="health-attention"></tbody>
            </table>
          </div>
          <details>
            <summary id="health-details-summary">View all statuses</summary>
            <div class="status-table-wrap">
              <table>
                <thead><tr><th>Venue</th><th>Market</th><th>Status</th><th>Sample Age</th><th>Reason</th></tr></thead>
                <tbody id="health-status"></tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </section>
    <section class="drilldown-section" aria-labelledby="history-title">
      <div class="section-heading">
        <div>
          <h2 id="history-title">Venue / Market Drilldown</h2>
          <p class="muted" id="history-note">Loading 7 day history...</p>
        </div>
        <div class="control-row">
          <label class="control" for="drilldown-market">Market<select id="drilldown-market"></select></label>
          <label class="control" for="drilldown-venue">Venue<select id="drilldown-venue"></select></label>
        </div>
      </div>
      <div id="history"></div>
    </section>
    <div class="insights-grid">
      <section class="insight-panel" aria-labelledby="summary-title">
        <h2 id="summary-title">Daily Summary</h2>
        <p class="muted" id="summary-note">Loading daily summaries...</p>
        <ul class="summary-list" id="daily-summary"></ul>
      </section>
      <section class="insight-panel" aria-labelledby="anomaly-title">
        <h2 id="anomaly-title">Public Anomaly Feed</h2>
        <p class="muted" id="anomaly-note">Loading public anomaly events...</p>
        <ul class="anomaly-list" id="anomalies"></ul>
      </section>
    </div>
  </main>
  <script>
    const venues = ["hyperliquid", "standx", "aster", "edgex", "grvt", "lighter", "extended", "nado"];
    const benchmarkVenues = ${JSON.stringify(benchmarkVenues)};
    const referenceVenues = ${JSON.stringify(referenceVenues)};
    const displayVenues = benchmarkVenues.concat(referenceVenues);
    const markets = ${JSON.stringify(markets)};
    const visibleMarkets = ${JSON.stringify(markets)};
    const labels = { hyperliquid: "Hyperliquid", standx: "StandX", aster: "Aster", edgex: "edgeX", grvt: "GRVT", lighter: "Lighter", extended: "Extended", nado: "Nado" };
    const dataBaseUrl = ${JSON.stringify(dataBaseUrl)};
    const fmt = (value, digits = 2) => typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "N/A";
    const dataUrl = (name) => dataBaseUrl ? dataBaseUrl + "/data/" + name : "data/" + name;
    let refreshInFlight = false;
    let selectedMarket = "BTC";
    let selectedPair = null;
    let latestState = null;
    let rowMapState = null;
    let historyState = null;
    let healthState = null;

    loadData().then(([latest, history, summaries, health, anomalies]) => {
        renderData(latest, history, summaries, health, anomalies);
        setInterval(refreshData, 60_000);
      });

    window.addEventListener("hashchange", () => {
      const hashMarket = marketFromHash();
      if (hashMarket && hashMarket !== selectedMarket) {
        selectedMarket = hashMarket;
        renderMarketTabs();
        if (latestState && rowMapState) renderComparison(latestState, rowMapState);
      }
      if (historyState && healthState) renderDrilldown(historyState, healthState);
    });

    function loadData(ts = null) {
      const suffix = ts ? "?ts=" + ts : "";
      return Promise.all([
        fetchJson("latest.json", suffix),
        fetchJson("history-7d.json", suffix),
        fetchJson("daily-summary.json", suffix),
        fetchJson("health.json", suffix),
        fetchJson("anomalies.json", suffix)
      ]);
    }

    function fetchJson(name, suffix) {
      return fetch(dataUrl(name) + suffix).then((response) => {
        if (!response.ok) throw new Error("Failed to load " + name);
        return response.json();
      });
    }

    function refreshData() {
      if (refreshInFlight) return;
      refreshInFlight = true;
      const ts = Date.now();
      loadData(ts)
        .then(([latest, history, summaries, health, anomalies]) => {
          renderData(latest, history, summaries, health, anomalies);
        })
        .catch(() => {
          const freshness = document.getElementById("freshness");
          if (!freshness.textContent.includes("refresh failed")) freshness.textContent += " · refresh failed; keeping last good data";
        })
        .finally(() => {
          refreshInFlight = false;
        });
    }

    function renderData(latest, history, summaries, health, anomalies) {
      latestState = latest;
      historyState = history;
      healthState = health;
      renderLatest(latest);
      renderHealth(health);
      renderSummaries(summaries);
      renderDrilldown(history, health);
      renderAnomalies(anomalies);
    }

    function renderLatest(latest) {
      const generatedAt = new Date(latest.generatedAt);
      const freshness = document.getElementById("freshness");
      freshness.textContent = "Updated " + relativeAge(generatedAt);
      freshness.title = latest.generatedAt + " · " + generatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      const rowMap = new Map();
      for (const row of latest.rows) rowMap.set(row.venue + ":" + row.market, row);
      rowMapState = rowMap;
      const hashMarket = marketFromHash();
      if (hashMarket) selectedMarket = hashMarket;
      renderMarketTabs();
      renderComparison(latest, rowMap);
    }

    function relativeAge(date) {
      const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      if (!Number.isFinite(seconds)) return "recently";
      if (seconds < 5) return "just now";
      if (seconds < 60) return seconds + "s ago";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return minutes + "m ago";
      return Math.floor(minutes / 60) + "h ago";
    }

    function marketFromHash() {
      const market = location.hash.slice(1).split(":")[0];
      return visibleMarkets.includes(market) ? market : null;
    }

    function renderMarketTabs() {
      const tabs = document.getElementById("market-tabs");
      tabs.innerHTML = visibleMarkets.map((market) =>
        "<button class='market-tab' type='button' role='tab' id='market-tab-" + market + "' aria-controls='comparison' aria-selected='" + (market === selectedMarket) + "' tabindex='" + (market === selectedMarket ? "0" : "-1") + "' data-market='" + market + "'>" + market + "</button>"
      ).join("");
      const buttons = [...tabs.querySelectorAll(".market-tab")];
      buttons.forEach((button, index) => {
        button.onclick = () => selectMarket(button.dataset.market);
        button.onkeydown = (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[nextIndex].focus();
          selectMarket(buttons[nextIndex].dataset.market);
        };
      });
    }

    function selectMarket(market) {
      if (!visibleMarkets.includes(market)) return;
      selectedMarket = market;
      renderMarketTabs();
      if (latestState && rowMapState) renderComparison(latestState, rowMapState);
    }

    function renderComparison(latest, rowMap) {
      const market = selectedMarket;
      const rows = displayVenues.map((venue) => {
        const target = latest.targets.find((item) => item.venue === venue && item.market === market);
        const row = rowMap.get(venue + ":" + market);
        const notListed = target && target.status === "not_listed";
        const reference = referenceVenues.includes(venue);
        const status = notListed ? "N/A: not listed" : (row?.status ?? "no sample");
        return { venue, target, row, notListed, reference, status: reference ? status + " - Reference" : status };
      });
      const benchmarkRows = sortRowsByDepth(rows.filter((item) => !item.reference));
      const referenceRows = sortRowsByDepth(rows.filter((item) => item.reference));
      const depth3Best = metricBest(benchmarkRows, "depth_3bp_total_usd", "high");
      const depth5Best = metricBest(benchmarkRows, "depth_5bp_total_usd", "high");
      const depthBest = metricBest(benchmarkRows, "depth_10bp_total_usd", "high");
      const slipBest = metricBest(benchmarkRows, "avg_slippage_100k_bp", "low");
      const slip1mBest = metricBest(benchmarkRows, "avg_slippage_1m_bp", "low");
      const validCount = benchmarkRows.filter((item) => metricValue(item, "spread_bp") !== null).length;
      document.getElementById("market-live").textContent = validCount + "/" + benchmarkVenues.length + " benchmark live";
      const rowHtml = (items) => items.map((item) => {
        const rowClass = item.notListed ? " class='na-row'" : (item.reference ? " class='reference-row'" : "");
        return "<tr" + rowClass + ">" +
          "<td class='venue-name' data-label='Venue'><a class='venue-link' data-pair='" + market + ":" + item.venue + "' href='#" + market + ":" + item.venue + "'>" + labels[item.venue] + (item.reference ? " (reference)" : "") + "</a></td>" +
          "<td class='status' data-label='Status'>" + item.status + "</td>" +
          metricCell(item, "depth_10bp_total_usd", "10bp Depth", "usd", depthBest, depthRatio) +
          metricCell(item, "depth_5bp_total_usd", "5bp Depth", "usd", depth5Best, depthRatio) +
          metricCell(item, "depth_3bp_total_usd", "3bp Depth", "usd", depth3Best, depthRatio) +
          metricCell(item, "avg_slippage_100k_bp", "100k Slippage", "bp", slipBest, spreadDelta) +
          metricCell(item, "avg_slippage_1m_bp", "1M Slippage", "bp", slip1mBest, spreadDelta) +
          spreadCell(item) +
        "</tr>";
      }).join("");
      document.getElementById("comparison").innerHTML =
        "<article class='market-panel' role='tabpanel' aria-labelledby='market-tab-" + market + "'>" +
          "<h3>" + market + " execution quality</h3>" +
          "<table><thead><tr><th>Venue</th><th>Status</th><th>10bp Depth</th><th>5bp Depth</th><th>3bp Depth</th><th>100k Slippage</th><th>1M Slippage</th><th>Spread</th></tr></thead><tbody>" +
          "<tr class='group-row'><th colspan='8'>Benchmark venues</th></tr>" + rowHtml(benchmarkRows) +
          "<tr class='group-row'><th colspan='8'>Reference venues</th></tr>" + rowHtml(referenceRows) +
          "</tbody></table>" +
        "</article>";
      document.querySelectorAll(".venue-link").forEach((link) => {
        link.onclick = (event) => {
          event.preventDefault();
          selectedPair = link.dataset.pair;
          location.hash = selectedPair;
          if (historyState && healthState) renderDrilldown(historyState, healthState);
          document.getElementById("history-title").scrollIntoView({ behavior: "smooth", block: "start" });
        };
      });
    }

    function metricCell(item, key, label, unit, best, deltaFn) {
      const value = metricValue(item, key);
      if (value === null) return "<td data-label='" + label + "'><span class='metric-value'>N/A</span><span class='metric-note'>No comparable sample</span></td>";
      const isBest = !item.reference && best !== null && value === best;
      const className = isBest ? "best-cell" : "";
      const display = unit === "usd" ? "$" + fmt(value, 0) : fmt(value, 3) + " bp";
      const badge = isBest ? "<span class='best-badge'>Best</span>" : (item.reference ? "<span class='reference-badge'>Reference</span>" : "");
      const note = item.reference ? "Reference only" : (isBest ? "best in market" : deltaFn(value, best));
      const attrs = (className ? " class='" + className + "'" : "") + " data-label='" + label + "'";
      return "<td" + attrs + "><span class='metric-value'>" + display + badge + "</span><span class='metric-note'>" + note + "</span></td>";
    }

    function spreadCell(item) {
      const value = metricValue(item, "spread_bp");
      if (value === null) return "<td data-label='Spread'><span class='metric-value'>N/A</span><span class='metric-note'>No comparable sample</span></td>";
      const badge = item.reference ? "<span class='reference-badge'>Reference</span>" : "";
      const note = item.reference ? "Reference only" : "Tick-size sensitive";
      return "<td data-label='Spread'><span class='metric-value'>" + fmt(value, 3) + " bp" + badge + "</span><span class='metric-note'>" + note + "</span></td>";
    }

    function metricValue(item, key) {
      const value = item.row?.[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    }

    function metricBest(rows, key, direction) {
      const values = rows.map((item) => metricValue(item, key)).filter((value) => value !== null);
      if (!values.length) return null;
      return direction === "low" ? Math.min(...values) : Math.max(...values);
    }

    function sortRowsByDepth(rows) {
      return rows.slice().sort((left, right) => {
        const leftDepth = metricValue(left, "depth_10bp_total_usd") ?? -1;
        const rightDepth = metricValue(right, "depth_10bp_total_usd") ?? -1;
        return rightDepth - leftDepth;
      });
    }

    function spreadDelta(value, best) {
      if (best === null) return "No benchmark";
      return "+" + fmt(Math.max(0, value - best), 3) + " bp vs best";
    }

    function depthRatio(value, best) {
      if (best === null || best === 0) return "No benchmark";
      return fmt(value / best, 2) + "x best depth";
    }

    function renderSummaries(summaries) {
      const rows = Array.isArray(summaries) ? summaries.filter((row) => visibleMarkets.includes(row.market)).slice(0, 6) : [];
      document.getElementById("summary-note").textContent = rows.length
        ? rows.length + " latest UTC daily summaries."
        : "No daily summary has been generated yet.";
      document.getElementById("daily-summary").innerHTML = rows.map((row) =>
        "<li><strong>" + (row.utc_date ?? "unknown date") + " " + (row.market ?? "") + "</strong>: " + (row.summary ?? "") + "</li>"
      ).join("");
    }

    function renderHealth(health) {
      const statusRows = Array.isArray(health?.statuses) ? health.statuses : [];
      const issueRows = statusRows.filter((row) => row.status !== "ok");
      const age = health?.latestSampleAgeSeconds;
      document.getElementById("health-note").textContent = issueRows.length ? issueRows.length + " items need attention" : "No current issues";
      document.getElementById("health-grid").innerHTML = [
        ["Updated", age === null || age === undefined ? "N/A" : age + "s ago"],
        ["Valid samples", (health?.validSampleCount ?? "N/A") + " / " + (health?.expectedTargetCount ?? "N/A")],
        ["Attention items", issueRows.length]
      ].map(([label, value]) => "<div class='health-item'><span>" + label + "</span><strong>" + value + "</strong></div>").join("");
      const groups = new Map();
      for (const row of issueRows) groups.set(row.status, [...(groups.get(row.status) ?? []), row]);
      const issueTypes = ["insufficient_depth", "not_listed", "failed", "unavailable"];
      document.getElementById("health-attention").innerHTML = issueTypes.map((status) => {
        const rows = groups.get(status) ?? [];
        const examples = rows.slice(0, 5).map((row) => (labels[row.venue] ?? row.venue) + " / " + row.market).join(" · ");
        return "<tr><td>" + humanStatus(status) + "</td><td>" + rows.length + "</td><td>" + (examples || "—") + "</td></tr>";
      }).join("");
      document.getElementById("health-details-summary").textContent = "View all " + statusRows.length + " statuses";
      document.getElementById("health-status").innerHTML = statusRows.map((row) =>
        "<tr><td>" + (labels[row.venue] ?? row.venue) + "</td><td>" + row.market + "</td><td>" + humanStatus(row.status) + "</td><td>" + (row.latest_sample_age_seconds === null ? "N/A" : row.latest_sample_age_seconds + "s") + "</td><td>" + (row.reason ?? "") + "</td></tr>"
      ).join("");
    }

    function humanStatus(status) {
      return String(status ?? "unknown").split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    }

    function renderDrilldown(history, health) {
      const validRows = history.filter((row) => row.valid !== 0 && row.spread_bp !== null);
      document.getElementById("history-note").textContent = validRows.length
        ? validRows.length + " valid 15 minute rollup buckets in the exported 7 day window."
        : "No valid metric samples in the exported 7 day window yet.";
      const pairs = displayVenues.flatMap((venue) => visibleMarkets.map((market) => ({ venue, market })));
      const hashPair = location.hash ? location.hash.slice(1) : "";
      selectedPair = pairs.some((pair) => pair.market + ":" + pair.venue === hashPair) ? hashPair : (selectedPair ?? "BTC:standx");
      const [market, venue] = selectedPair.split(":");
      const marketSelect = document.getElementById("drilldown-market");
      const venueSelect = document.getElementById("drilldown-venue");
      marketSelect.innerHTML = visibleMarkets.map((item) => "<option value='" + item + "'" + (item === market ? " selected" : "") + ">" + item + "</option>").join("");
      venueSelect.innerHTML = displayVenues.map((item) => "<option value='" + item + "'" + (item === venue ? " selected" : "") + ">" + labels[item] + "</option>").join("");
      const updatePair = () => {
        selectedPair = marketSelect.value + ":" + venueSelect.value;
        location.hash = selectedPair;
        renderDrilldown(history, health);
      };
      marketSelect.onchange = updatePair;
      venueSelect.onchange = updatePair;
      const rows = validRows.filter((row) => row.market === market && row.venue === venue);
      const expectedBuckets = Math.max(1, Math.ceil((7 * 24 * 60) / 15));
      const missingSamples = Math.max(0, expectedBuckets - rows.reduce((sum, row) => sum + (row.sample_count ?? 0), 0));
      const insufficient100k = rows.reduce((sum, row) => sum + (row.insufficient_depth_100k_count ?? 0), 0);
      const insufficient1m = rows.reduce((sum, row) => sum + (row.insufficient_depth_1m_count ?? 0), 0);
      document.getElementById("history").innerHTML =
        "<div class='history-panel'>" +
          "<h3>" + market + " / " + labels[venue] + "</h3>" +
          "<dl>" +
            historyStat("Rollup buckets", rows.length) +
            historyStat("Samples", rows.reduce((sum, row) => sum + (row.sample_count ?? 0), 0)) +
            historyStat("Missing samples", missingSamples) +
            historyStat("Insufficient-depth", insufficient100k + insufficient1m) +
            historyStat("Median spread", fmt(median(rows.map((row) => row.spread_bp)), 3) + " bp") +
            historyStat("Median 10bp depth", "$" + fmt(median(rows.map((row) => row.depth_10bp_total_usd)), 0)) +
            historyStat("Median 5bp depth", "$" + fmt(median(rows.map((row) => row.depth_5bp_total_usd)), 0)) +
            historyStat("Median 3bp depth", "$" + fmt(median(rows.map((row) => row.depth_3bp_total_usd)), 0)) +
            historyStat("Median 100k slippage", fmt(median(rows.map((row) => row.avg_slippage_100k_bp)), 3) + " bp") +
            historyStat("Median 1M slippage", fmt(median(rows.map((row) => row.avg_slippage_1m_bp)), 3) + " bp") +
          "</dl>" +
        "</div>";
    }

    function historyStat(label, value) {
      return "<div class='history-stat'><dt>" + label + "</dt><dd>" + value + "</dd></div>";
    }

    function renderAnomalies(anomalies) {
      const rows = Array.isArray(anomalies) ? anomalies.slice(0, 20) : [];
      document.getElementById("anomaly-note").textContent = rows.length
        ? rows.length + " recent public anomaly events."
        : "No public anomaly events exported yet.";
      document.getElementById("anomalies").innerHTML = rows.map((row) =>
        "<li><strong>" + (row.market ?? "") + " / " + (labels[row.venue] ?? row.venue ?? "") + " / " + (row.metric ?? "") + "</strong>: " +
        (row.message ?? "") + " <span class='muted'>start " + (row.start_timestamp_ms ?? "N/A") + ", end " + (row.end_timestamp_ms ?? "N/A") + ", baseline " + (row.baseline ?? "N/A") + ", observed " + (row.observed_value ?? "N/A") + ", dedupe_key " + (row.dedupe_key ?? row.dedupeKey ?? "N/A") + "</span></li>"
      ).join("");
    }

    function median(values) {
      const nums = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
      if (!nums.length) return null;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }
  </script>
</body>
</html>`;
}

function methodologyHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Methodology - Perp Execution Quality Benchmark</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1d2329; background: #f7f4ee; }
    main { max-width: 900px; margin: 0 auto; padding: 32px; background: #ffffff; min-height: 100vh; }
    h1, h2 { letter-spacing: 0; }
    p, li { line-height: 1.6; color: #34404a; }
    code { background: #f0eee8; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
<main>
  <h1>Methodology</h1>
  <p>This benchmark compares public perp order book execution quality for StandX, edgeX, GRVT, Lighter, Extended, and Nado on BTC, ETH, SOL, and XAU, with Hyperliquid and Aster shown as reference venues only. It is not a trading signal, liquidation monitor, whale tracker, vault dashboard, or venue marketing page.</p>

  <h2>Data Sources</h2>
  <ul>
    <li>Hyperliquid: <code>POST https://api.hyperliquid.xyz/info</code> with <code>type=l2Book</code>. The collector requests full precision plus progressively aggregated <code>nSigFigs</code>/<code>mantissa</code> books, each limited to 20 levels per side. XAU maps to the HIP-3 <code>xyz:GOLD</code> market.</li>
    <li>StandX: <code>GET https://perps.standx.com/api/query_depth_book</code> for depth and slippage; <code>GET https://perps.standx.com/api/query_symbol_market</code> for quoted top-of-book spread. StandX <code>SOL-USD</code> and <code>XAU-USD</code> are tracked when they appear in public symbol data.</li>
    <li>Aster: <code>GET https://fapi.asterdex.com/fapi/v1/depth</code> for USDT-margined perpetual futures.</li>
    <li>edgeX: <code>GET https://pro.edgex.exchange/api/v1/public/quote/getDepth</code> with public contract ids. The public REST snapshot supports fixed depth levels; this benchmark requests level 200.</li>
    <li>GRVT: <code>POST https://market-data.grvt.io/full/v1/book</code> for public perpetual order book depth. This benchmark requests 50 levels per side.</li>
    <li>Lighter: <code>GET https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders</code> for public order-level snapshots. This benchmark requests up to 250 orders per side and aggregates them into price levels before computing metrics.</li>
    <li>Extended: <code>GET https://api.starknet.extended.exchange/api/v1/info/markets/{market}/orderbook</code> for public perpetual order book depth.</li>
    <li>Nado: <code>GET https://gateway.prod.nado.xyz/v1/query?type=market_liquidity</code> for public perpetual market liquidity. This benchmark requests 50 levels per side and converts x18 price and size values into price levels.</li>
  </ul>

  <h2>Cadence</h2>
  <p>The collector runs every 30 to 60 seconds. The default is 60 seconds. Latest public metrics can be refreshed every collector round, while 7 day history is exported as 15 minute rollups every 5 minutes.</p>

  <h2>Spread</h2>
  <p><code>mid = (best_bid + best_ask) / 2</code></p>
  <p><code>spread_bp = ((best_ask - best_bid) / mid) * 10000</code></p>
  <p>Spread is a top-of-book signal and can be affected by venue tick size or public-book aggregation. Depth and estimated taker slippage are the primary comparability metrics.</p>

  <h2>3bp, 5bp, and 10bp Depth</h2>
  <p>Bid depth sums <code>price * size</code> where <code>price >= best_bid * (1 - bp / 10000)</code>.</p>
  <p>Ask depth sums <code>price * size</code> where <code>price <= best_ask * (1 + bp / 10000)</code>.</p>
  <p>The public table shows two-sided total depth: <code>depth_total_usd = depth_bid_usd + depth_ask_usd</code>. JSON and SQLite keep bid, ask, and total fields for each depth band.</p>
  <p>For Hyperliquid, each band uses the highest-precision returned book that reaches the requested boundary on both sides. If no returned precision covers the band, the metric is displayed as <code>N/A</code> instead of treating a truncated book as complete.</p>

  <h2>100,000 and 1,000,000 USD Estimated Taker Slippage</h2>
  <p>A buy order consumes asks from best ask upward until the target notional is filled. A sell order consumes bids from best bid downward. The public table shows both 100,000 USD and 1,000,000 USD average taker slippage.</p>
  <p>If the returned public book cannot fill the target notional on either side, that target-size metric is marked insufficient public depth and displayed as <code>N/A</code>.</p>
  <p><code>buy_slippage_bp = ((buy_avg_px - mid) / mid) * 10000</code></p>
  <p><code>sell_slippage_bp = ((mid - sell_avg_px) / mid) * 10000</code></p>

  <h2>Comparability Limits</h2>
  <ul>
    <li>Only public order book data is used.</li>
    <li>Hidden, private, or venue-internal liquidity is not measured.</li>
    <li>Each Hyperliquid public-book precision is limited to 20 levels per side, so wider bands use documented price aggregation and remain approximate near aggregation boundaries.</li>
    <li>Hyperliquid and Aster are displayed as reference venues and are excluded from public <code>Best</code> calculations and daily winner summaries.</li>
    <li>Tracked venue-market pairs are not replaced with alternate markets; if a public symbol disappears, that state is surfaced as <code>N/A: not listed</code>.</li>
    <li>edgeX, GRVT, Lighter, Extended, and Nado are included as emerging benchmark venues under the same public-book method, not as endorsed or sponsored venues.</li>
  </ul>

  <h2>Public Data Files</h2>
  <ul>
    <li><code>data/latest.json</code>: latest target list and latest comparable metric rows.</li>
    <li><code>data/health.json</code>: export time, latest sample age, expected target count, valid sample count, failed count, not-listed count, insufficient-depth count, unavailable count, and per venue/market recent status.</li>
    <li><code>data/history-7d.json</code>: 15 minute venue/market rollups from persistent SQLite history, including sample counts and insufficient-depth counts.</li>
    <li><code>data/daily-summary.json</code>: copyable daily market notes. These do not contain trading advice.</li>
    <li><code>data/anomalies.json</code>: public anomaly events with metric, venue, market, start/end time, baseline, observed value, message, and dedupe key when available.</li>
  </ul>
  <p>The static JSON files are the public API for this milestone. CSV export and an interactive API are not currently provided. See <code>docs/public-data.md</code> in the repository for field semantics, freshness semantics, and consumer guidance.</p>
</main>
</body>
</html>`;
}
