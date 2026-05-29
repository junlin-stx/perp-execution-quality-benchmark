# Deployment Runbook

This benchmark needs persistent storage. The 7 day history comes from `data/benchmark.sqlite`, so a disposable CI job that starts from an empty checkout every 5 minutes will publish a fresh page but will not build a real 7 day history.

## Recommended Phase-One Deployment

Run the collector on a small always-on host and serve `public/` with any static file server.

Requirements:

- Node.js 22 or newer.
- Persistent disk for `data/benchmark.sqlite`.
- A process manager such as `systemd`, `pm2`, `supervisord`, Docker restart policy, or an equivalent host-level supervisor.
- A static host or reverse proxy that serves the generated `public/` directory.

## Host Setup

```bash
git clone <public-repo-url> perp-bench
cd perp-bench
npm ci
npm test
npm run typecheck
npm run run:benchmark -- --once
```

The one-shot command should print:

```text
collected=20 failed=0 not_listed=1
exported static benchmark to public
```

`not_listed=1` is expected while StandX does not list `SOL-USD`.

## Long-Running Collector

Run:

```bash
npm run run:benchmark
```

Defaults:

- Collect every 60 seconds.
- Export static files every 300 seconds.
- Store SQLite data in `data/benchmark.sqlite`.
- Write static files to `public/`.

Custom paths:

```bash
npm run run:benchmark -- --db /var/lib/perp-bench/benchmark.sqlite --out /var/www/perp-bench
```

## Static Serving

Serve the output directory as a static site. The public URL must serve:

- `/index.html`
- `/methodology.html`
- `/data/latest.json`
- `/data/history-7d.json`
- `/data/daily-summary.json`
- `/data/anomalies.json`

## Daily Summary Job

Run once per day after the UTC day closes:

```bash
npm run summary
npm run export
```

The summary command writes rows into SQLite. The export command writes those summaries into `public/data/daily-summary.json`.

## Telegram Anomaly Job

Dry run:

```bash
npm run anomaly:dry-run
```

Send exported anomaly events:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_CHAT_ID="@your_channel"
npm run telegram:send-anomalies
```

The Telegram sender only reads `public/data/anomalies.json`. It does not generate alpha, liquidation, whale, vault, or trading-signal content.

## Health Checks

Use these checks after deployment:

```bash
curl -fsS https://<public-site>/data/latest.json
curl -fsS https://<public-site>/methodology.html
```

Verify local data freshness:

```bash
node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('public/data/latest.json','utf8')); console.log(j.generatedAt, j.rows.length)"
```

Verify methodology boundaries:

```bash
```

## Why Not Pure Scheduled Static CI

A scheduled CI job can publish `public/`, but it usually starts from a clean checkout. Without a persistent `data/benchmark.sqlite`, the 7 day history and daily summaries are not trustworthy. Use CI only if it restores and saves the SQLite database or writes to another durable store.
