import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectionTargets } from "../config/markets.js";
import { BenchmarkDb } from "../storage/sqlite.js";

export function exportStaticSite(db: BenchmarkDb, outputDir = "public"): void {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });

  const latest = {
    generatedAt: new Date().toISOString(),
    targets: collectionTargets,
    rows: db.getLatestGrid()
  };
  const history = db.getHistorySince(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const summaries = db.getDailySummaries();
  const anomalies = db.getRecentAnomalies();

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
    table { border-collapse: collapse; width: 100%; background: #ffffff; border: 1px solid #d8d2c5; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e8e2d6; text-align: left; font-size: 14px; }
    th { background: #22333b; color: #ffffff; position: sticky; top: 0; }
    .muted { color: #6c747d; }
    .status { font-weight: 650; }
    .toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
    a { color: #0d5c63; }
  </style>
</head>
<body>
  <header>
    <h1>Perp Execution Quality Benchmark</h1>
    <p>Open benchmark for spread, 10bp depth, and estimated 100,000 USD taker slippage across Hyperliquid, Binance Perps, Aevo, and StandX.</p>
  </header>
  <main>
    <div class="toolbar">
      <p class="muted" id="freshness">Loading latest data...</p>
      <a href="methodology.html">Methodology</a>
    </div>
    <table>
      <thead>
        <tr>
          <th>Venue</th>
          <th>Market</th>
          <th>Status</th>
          <th>Spread (bp)</th>
          <th>10bp Depth (USD)</th>
          <th>100k Slippage (bp)</th>
        </tr>
      </thead>
      <tbody id="grid"></tbody>
    </table>
  </main>
  <script>
    const venues = ["hyperliquid", "binance_perps", "aevo", "standx"];
    const markets = ["BTC", "ETH", "SOL"];
    const labels = { hyperliquid: "Hyperliquid", binance_perps: "Binance Perps", aevo: "Aevo", standx: "StandX" };
    const fmt = (value, digits = 2) => typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "N/A";

    fetch("data/latest.json")
      .then((response) => response.json())
      .then((latest) => {
        document.getElementById("freshness").textContent = "Generated " + latest.generatedAt;
        const rowMap = new Map();
        for (const row of latest.rows) rowMap.set(row.venue + ":" + row.market, row);
        document.getElementById("grid").innerHTML = venues.flatMap((venue) => markets.map((market) => {
          const target = latest.targets.find((item) => item.venue === venue && item.market === market);
          const row = rowMap.get(venue + ":" + market);
          const notListed = target && target.status === "not_listed";
          const status = notListed ? "N/A: not listed" : (row?.status ?? "no sample");
          return "<tr>" +
            "<td>" + labels[venue] + "</td>" +
            "<td>" + market + "</td>" +
            "<td class='status'>" + status + "</td>" +
            "<td>" + (notListed ? "N/A" : fmt(row?.spread_bp, 3)) + "</td>" +
            "<td>" + (notListed ? "N/A" : fmt(row?.depth_10bp_total_usd, 0)) + "</td>" +
            "<td>" + (notListed ? "N/A" : fmt(row?.avg_slippage_100k_bp, 3)) + "</td>" +
            "</tr>";
        })).join("");
      });
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
  <p>This benchmark compares public perp order book execution quality for Hyperliquid, Binance Perps, Aevo, and StandX on BTC, ETH, and SOL. It is not a trading signal, liquidation monitor, whale tracker, vault dashboard, or StandX marketing page.</p>

  <h2>Data Sources</h2>
  <ul>
    <li>Hyperliquid: <code>POST https://api.hyperliquid.xyz/info</code> with <code>type=l2Book</code>. Public response returns up to 20 levels per side.</li>
    <li>Binance Perps: <code>GET https://fapi.binance.com/fapi/v1/depth</code> for USD-M futures. Binance RPI liquidity is not included in this public book.</li>
    <li>Aevo: <code>GET https://api.aevo.xyz/orderbook</code> by <code>instrument_name</code>.</li>
    <li>StandX: <code>GET https://perps.standx.com/api/query_depth_book</code>; bids and asks are sorted client-side. StandX SOL is shown as not listed until <code>SOL-USD</code> appears in the public symbol list.</li>
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
    <li>Binance RPI orders are not represented in the public depth endpoint.</li>
    <li>StandX SOL is not replaced with another StandX market; it remains <code>N/A: not listed</code>.</li>
  </ul>
</main>
</body>
</html>`;
}
