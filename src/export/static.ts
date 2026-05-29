import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectionTargets, venues } from "../config/markets.js";
import { BenchmarkDb } from "../storage/sqlite.js";

export function exportStaticSite(db: BenchmarkDb, outputDir = "public"): void {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });
  const activeVenues = new Set<string>(venues);

  const latest = {
    generatedAt: new Date().toISOString(),
    targets: collectionTargets,
    rows: filterActiveVenueRows(db.getLatestGrid(), activeVenues)
  };
  const history = filterActiveVenueRows(db.getHistorySince(Date.now() - 7 * 24 * 60 * 60 * 1000), activeVenues);
  const summaries = filterRemovedVenueSummaries(db.getDailySummaries());
  const anomalies = filterActiveVenueRows(db.getRecentAnomalies(), activeVenues);

  writeJson(join(dataDir, "latest.json"), latest);
  writeJson(join(dataDir, "history-7d.json"), history);
  writeJson(join(dataDir, "daily-summary.json"), summaries);
  writeJson(join(dataDir, "anomalies.json"), anomalies);
  writeFileSync(join(outputDir, "index.html"), indexHtml(), "utf8");
  writeFileSync(join(outputDir, "methodology.html"), methodologyHtml(), "utf8");
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

function indexHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Perp Execution Quality Benchmark</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1d2329; background: #f7f4ee; }
    body { margin: 0; }
    header { padding: 28px 32px 18px; background: #ffffff; border-bottom: 1px solid #d8d2c5; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { margin: 0; line-height: 1.5; color: #4c5560; }
    main { padding: 24px 32px 40px; max-width: 1280px; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e8e2d6; text-align: left; font-size: 14px; vertical-align: top; }
    th { color: #59636d; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    h2 { margin: 28px 0 10px; font-size: 20px; letter-spacing: 0; }
    .muted { color: #6c747d; }
    .status { font-weight: 650; }
    .toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
    .comparison-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr)); gap: 14px; align-items: start; }
    .market-panel { background: #ffffff; border: 1px solid #d8d2c5; min-width: 0; }
    .market-panel h2 { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 0; padding: 12px 14px; border-bottom: 1px solid #e8e2d6; background: #22333b; color: #ffffff; font-size: 18px; }
    .market-panel h2 span { color: #dce8e4; font-size: 12px; font-weight: 600; }
    .venue-name { font-weight: 750; white-space: nowrap; }
    .metric-value { display: block; font-variant-numeric: tabular-nums; font-weight: 720; }
    .metric-note { display: block; margin-top: 3px; color: #6c747d; font-size: 12px; line-height: 1.25; }
    .best-cell { background: #eef8f3; }
    .worst-cell { background: #fff3ec; }
    .best-badge { display: inline-block; margin-left: 6px; padding: 1px 5px; border-radius: 4px; background: #0d6b4f; color: #ffffff; font-size: 11px; font-weight: 750; }
    .na-row { color: #6c747d; background: #faf8f3; }
    .history-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 12px; }
    .history-panel { background: #ffffff; border: 1px solid #d8d2c5; padding: 12px; min-width: 0; }
    .history-panel h3 { margin: 0 0 8px; font-size: 15px; letter-spacing: 0; }
    .history-panel dl { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; margin: 0; font-size: 13px; }
    .history-panel dt { color: #59636d; }
    .history-panel dd { margin: 0; font-weight: 650; }
    .summary-list { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    .summary-list li { background: #ffffff; border: 1px solid #d8d2c5; padding: 10px 12px; line-height: 1.45; }
    a { color: #0d5c63; }
    @media (max-width: 820px) {
      .history-grid { grid-template-columns: 1fr; }
      main { padding: 18px; }
      .market-panel table, .market-panel tbody, .market-panel tr, .market-panel td { display: block; }
      .market-panel thead { display: none; }
      .market-panel tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid #e8e2d6; }
      .market-panel td { min-width: 0; padding: 9px 8px; border-bottom: 0; font-size: 13px; }
      .market-panel td::before { content: attr(data-label); display: block; margin-bottom: 3px; color: #6c747d; font-size: 10px; font-weight: 750; text-transform: uppercase; }
      .market-panel .venue-name, .market-panel .status { grid-column: span 1; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Perp Execution Quality Benchmark</h1>
    <p>Open benchmark for spread, 10bp depth, and estimated 100,000 USD taker slippage across Hyperliquid, StandX, Aster, edgeX, GRVT, Lighter, Extended, and Nado.</p>
  </header>
  <main>
    <div class="toolbar">
      <p class="muted" id="freshness">Loading latest data...</p>
      <a href="methodology.html">Methodology</a>
    </div>
    <section aria-labelledby="comparison-title">
      <h2 id="comparison-title">Latest Comparison</h2>
      <div class="comparison-grid" id="comparison"></div>
    </section>
    <section aria-labelledby="summary-title">
      <h2 id="summary-title">Daily Summary</h2>
      <p class="muted" id="summary-note">Loading daily summaries...</p>
      <ul class="summary-list" id="daily-summary"></ul>
    </section>
    <section aria-labelledby="history-title">
      <h2 id="history-title">7 Day History</h2>
      <p class="muted" id="history-note">Loading 7 day history...</p>
      <div class="history-grid" id="history"></div>
    </section>
  </main>
  <script>
    const venues = ["hyperliquid", "standx", "aster", "edgex", "grvt", "lighter", "extended", "nado"];
    const markets = ["BTC", "ETH", "SOL"];
    const visibleMarkets = ["BTC", "ETH"];
    const labels = { hyperliquid: "Hyperliquid", standx: "StandX", aster: "Aster", edgex: "edgeX", grvt: "GRVT", lighter: "Lighter", extended: "Extended", nado: "Nado" };
    const fmt = (value, digits = 2) => typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "N/A";

    Promise.all([
      fetch("data/latest.json").then((response) => response.json()),
      fetch("data/history-7d.json").then((response) => response.json()),
      fetch("data/daily-summary.json").then((response) => response.json())
    ])
      .then(([latest, history, summaries]) => {
        document.getElementById("freshness").textContent = "Generated " + latest.generatedAt;
        const rowMap = new Map();
        for (const row of latest.rows) rowMap.set(row.venue + ":" + row.market, row);
        renderComparison(latest, rowMap);
        renderSummaries(summaries);
        renderHistory(history);
      });

    function renderComparison(latest, rowMap) {
      document.getElementById("comparison").innerHTML = markets.filter((market) => visibleMarkets.includes(market)).map((market) => {
        const rows = venues.map((venue) => {
          const target = latest.targets.find((item) => item.venue === venue && item.market === market);
          const row = rowMap.get(venue + ":" + market);
          const notListed = target && target.status === "not_listed";
          return { venue, target, row, notListed, status: notListed ? "N/A: not listed" : (row?.status ?? "no sample") };
        });
        const spreadBest = metricBest(rows, "spread_bp", "low");
        const spreadWorst = metricBest(rows, "spread_bp", "high");
        const depthBest = metricBest(rows, "depth_10bp_total_usd", "high");
        const depthWorst = metricBest(rows, "depth_10bp_total_usd", "low");
        const slipBest = metricBest(rows, "avg_slippage_100k_bp", "low");
        const slipWorst = metricBest(rows, "avg_slippage_100k_bp", "high");
        const validCount = rows.filter((item) => metricValue(item, "spread_bp") !== null).length;
        return "<article class='market-panel'>" +
          "<h2>" + market + "<span>" + validCount + "/" + venues.length + " live</span></h2>" +
          "<table><thead><tr>" +
            "<th>Venue</th><th>Status</th><th>Spread</th><th>10bp Depth</th><th>100k Slippage</th>" +
          "</tr></thead><tbody>" +
          rows.map((item) => {
            const rowClass = item.notListed ? " class='na-row'" : "";
            return "<tr" + rowClass + ">" +
              "<td class='venue-name' data-label='Venue'>" + labels[item.venue] + "</td>" +
              "<td class='status' data-label='Status'>" + item.status + "</td>" +
              metricCell(item, "spread_bp", "Spread", "bp", spreadBest, spreadWorst, spreadDelta) +
              metricCell(item, "depth_10bp_total_usd", "10bp Depth", "usd", depthBest, depthWorst, depthRatio) +
              metricCell(item, "avg_slippage_100k_bp", "100k Slippage", "bp", slipBest, slipWorst, spreadDelta) +
            "</tr>";
          }).join("") +
          "</tbody></table>" +
        "</article>";
      }).join("");
    }

    function metricCell(item, key, label, unit, best, worst, deltaFn) {
      const value = metricValue(item, key);
      if (value === null) return "<td data-label='" + label + "'><span class='metric-value'>N/A</span><span class='metric-note'>No comparable sample</span></td>";
      const isBest = best !== null && value === best;
      const isWorst = worst !== null && value === worst && value !== best;
      const className = isBest ? " class='best-cell'" : (isWorst ? " class='worst-cell'" : "");
      const display = unit === "usd" ? "$" + fmt(value, 0) : fmt(value, 3) + " bp";
      const badge = isBest ? "<span class='best-badge'>Best</span>" : "";
      const note = isBest ? "best in market" : deltaFn(value, best);
      const attrs = className ? className.replace(">", "") + " data-label='" + label + "'" : " data-label='" + label + "'";
      return "<td" + attrs + "><span class='metric-value'>" + display + badge + "</span><span class='metric-note'>" + note + "</span></td>";
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

    function renderHistory(history) {
      const validRows = history.filter((row) => row.valid !== 0 && row.spread_bp !== null);
      document.getElementById("history-note").textContent = validRows.length
        ? validRows.length + " valid metric samples in the exported 7 day window."
        : "No valid metric samples in the exported 7 day window yet.";
      document.getElementById("history").innerHTML = markets.filter((market) => visibleMarkets.includes(market)).map((market) => {
        const rows = validRows.filter((row) => row.market === market);
        return "<div class='history-panel'>" +
          "<h3>" + market + "</h3>" +
          "<dl>" +
            "<dt>Samples</dt><dd>" + rows.length + "</dd>" +
            "<dt>Median spread</dt><dd>" + fmt(median(rows.map((row) => row.spread_bp)), 3) + " bp</dd>" +
            "<dt>Median 10bp depth</dt><dd>$" + fmt(median(rows.map((row) => row.depth_10bp_total_usd)), 0) + "</dd>" +
            "<dt>Median 100k slippage</dt><dd>" + fmt(median(rows.map((row) => row.avg_slippage_100k_bp)), 3) + " bp</dd>" +
          "</dl>" +
        "</div>";
      }).join("");
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
  <p>This benchmark compares public perp order book execution quality for Hyperliquid, StandX, Aster, edgeX, GRVT, Lighter, Extended, and Nado on BTC, ETH, and SOL. It is not a trading signal, liquidation monitor, whale tracker, vault dashboard, or venue marketing page.</p>

  <h2>Data Sources</h2>
  <ul>
    <li>Hyperliquid: <code>POST https://api.hyperliquid.xyz/info</code> with <code>type=l2Book</code>. Public response returns up to 20 levels per side.</li>
    <li>StandX: <code>GET https://perps.standx.com/api/query_depth_book</code>; bids and asks are sorted client-side. StandX SOL is shown as not listed until <code>SOL-USD</code> appears in the public symbol list.</li>
    <li>Aster: <code>GET https://fapi.asterdex.com/fapi/v1/depth</code> for USDT-margined perpetual futures.</li>
    <li>edgeX: <code>GET https://pro.edgex.exchange/api/v1/public/quote/getDepth</code> with public contract ids. The public REST snapshot supports fixed depth levels; this benchmark requests level 200.</li>
    <li>GRVT: <code>POST https://market-data.grvt.io/full/v1/book</code> for public perpetual order book depth. This benchmark requests 50 levels per side.</li>
    <li>Lighter: <code>GET https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders</code> for public order-level snapshots. This benchmark requests up to 250 orders per side and aggregates them into price levels before computing metrics.</li>
    <li>Extended: <code>GET https://api.starknet.extended.exchange/api/v1/info/markets/{market}/orderbook</code> for public perpetual order book depth.</li>
    <li>Nado: <code>GET https://gateway.prod.nado.xyz/v1/query?type=market_liquidity</code> for public perpetual market liquidity. This benchmark requests 50 levels per side and converts x18 price and size values into price levels.</li>
  </ul>

  <h2>Cadence</h2>
  <p>The collector runs every 30 to 60 seconds. The default is 60 seconds. Static public artifacts are exported every 5 minutes.</p>

  <h2>Spread</h2>
  <p><code>mid = (best_bid + best_ask) / 2</code></p>
  <p><code>spread_bp = ((best_ask - best_bid) / mid) * 10000</code></p>

  <h2>10bp Depth</h2>
  <p>Bid depth sums <code>price * size</code> where <code>price >= best_bid * (1 - 0.001)</code>.</p>
  <p>Ask depth sums <code>price * size</code> where <code>price <= best_ask * (1 + 0.001)</code>.</p>
  <p>The public table shows total 10bp depth while JSON keeps side breakdowns.</p>

  <h2>100,000 USD Estimated Taker Slippage</h2>
  <p>A buy order consumes asks from best ask upward until 100,000 USD is filled. A sell order consumes bids from best bid downward. If the returned public book cannot fill 100,000 USD on either side, the metric is marked insufficient public depth.</p>
  <p><code>buy_slippage_bp = ((buy_avg_px - mid) / mid) * 10000</code></p>
  <p><code>sell_slippage_bp = ((mid - sell_avg_px) / mid) * 10000</code></p>

  <h2>Comparability Limits</h2>
  <ul>
    <li>Only public order book data is used.</li>
    <li>Hidden, private, or venue-internal liquidity is not measured.</li>
    <li>Hyperliquid public books are limited to 20 levels per side.</li>
    <li>StandX SOL is not replaced with another StandX market; it remains <code>N/A: not listed</code>.</li>
    <li>Aster, edgeX, GRVT, Lighter, Extended, and Nado are included as emerging venues under the same public-book method, not as endorsed or sponsored venues.</li>
  </ul>
</main>
</body>
</html>`;
}
