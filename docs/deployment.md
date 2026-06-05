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
collected=23 failed=0 not_listed=1
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
- Export `latest.json` every 60 seconds.
- Export 15 minute rollup history and static files every 300 seconds.
- Collect with 4 concurrent venue requests.
- Store SQLite data in `data/benchmark.sqlite`.
- Write static files to `public/`.

Custom paths:

```bash
npm run run:benchmark -- --db /var/lib/perp-bench/benchmark.sqlite --out /var/www/perp-bench
```

Realtime tuning:

```bash
npm run run:benchmark -- --collect-interval 60 --latest-export-interval 60 --history-export-interval 300 --concurrency 4
```

## PM2 Process Manager

`ecosystem.config.cjs` runs the recommended realtime collector and R2 publisher:

```bash
npm run run:benchmark -- --collect-interval 60 --latest-export-interval 60 --history-export-interval 300 --concurrency 4 --publish-r2
```

Install PM2 on the host, export the R2 environment variables, then start and persist the process list:

```bash
npm run pm2:start
npm run pm2:save
```

Common lifecycle commands:

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
npm run pm2:delete
```

## Cloudflare R2 Data Publishing

Use R2 as the public data layer while keeping SQLite as the local source of truth. Create an R2 bucket, enable public access through a custom domain or the development `r2.dev` URL, and create an R2 S3 API token with Object Read & Write permission for the bucket.

Required environment:

```bash
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET="perp-bench"
export R2_PREFIX="" # optional
```

Upload data once:

```bash
npm run publish:r2
```

Run the realtime collector and publish R2 data after exports:

```bash
npm run run:benchmark -- --collect-interval 60 --latest-export-interval 60 --history-export-interval 300 --concurrency 4 --publish-r2
```

Render the static page so it fetches public JSON from the R2 public domain:

```bash
PUBLIC_DATA_BASE_URL="https://<r2-public-domain>/<optional-prefix>" npm run export
```

For GitHub Pages, configure repository variables:

- `PUBLIC_DATA_BASE_URL`
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_PREFIX` if objects are written under a prefix

Configure repository secrets:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The GitHub Pages workflow uses `PUBLIC_DATA_BASE_URL` when rendering the page and publishes the exported JSON to R2 when all R2 variables and secrets are present. The long-running local collector should remain the primary realtime publisher; the workflow upload is only a fallback snapshot because scheduled GitHub Actions are not a strict 5 minute realtime system.

Set a CORS policy on the R2 bucket so GitHub Pages can fetch JSON from the R2 domain:

```json
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://junlin-stx.github.io",
          "http://localhost:4173"
        ],
        "methods": ["GET"]
      },
      "maxAgeSeconds": 3600
    }
  ]
}
```

Apply it with:

```bash
npx wrangler r2 bucket cors set perp-bench --file cors.json
npx wrangler r2 bucket cors list perp-bench
```

After changing CORS on a custom R2 domain, purge that hostname from Cloudflare Cache before testing in the browser.

Published object keys:

- `data/latest.json` with `Cache-Control: public, max-age=30, must-revalidate`
- `data/history-7d.json`, `data/daily-summary.json`, and `data/anomalies.json` with `Cache-Control: public, max-age=300, must-revalidate`

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
