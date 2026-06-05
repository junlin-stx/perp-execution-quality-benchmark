# Perp Execution Quality Benchmark

Open collector and static benchmark for basic perp execution quality across Hyperliquid, StandX, Aster, edgeX, GRVT, Lighter, Extended, and Nado.

Public repo: https://github.com/junlin-stx/perp-execution-quality-benchmark
Public benchmark: https://junlin-stx.github.io/perp-execution-quality-benchmark/

The first phase compares BTC, ETH, and SOL using:

- spread
- 10bp depth
- estimated slippage for 100,000 USD and 1,000,000 USD taker orders

This is not a trading signal, paid product, liquidation monitor, whale tracker, vault dashboard, or venue marketing page.

## Install

```bash
npm install
```

## Verify

```bash
npm test
npm run typecheck
```

## Collect Once

```bash
npm run collect -- --once
```

## Export Static Site

```bash
npm run export
```

## Run Collector and Static Export Loop

```bash
npm run run:benchmark
```

Defaults:

- collect every 60 seconds
- export `latest.json` every 60 seconds
- export 15 minute rollup history and static files every 300 seconds
- collect with 4 concurrent venue requests
- write SQLite data to `data/benchmark.sqlite`
- write static artifacts to `public/`

## Run With PM2

Install PM2 on the always-on host, configure the R2 environment variables, then start the realtime collector and R2 publisher:

```bash
npm run pm2:start
npm run pm2:save
```

Management commands:

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

## Publish Data to Cloudflare R2

Configure an R2 bucket with S3 API credentials:

```bash
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET="perp-bench"
export R2_PREFIX="" # optional, for example "perp-bench"
```

Upload the current `public/data/*.json` files:

```bash
npm run publish:r2
```

Or publish continuously from the local collector:

```bash
npm run run:benchmark -- --collect-interval 60 --latest-export-interval 60 --history-export-interval 300 --concurrency 4 --publish-r2
```

R2 object keys are `data/latest.json`, `data/history-7d.json`, `data/daily-summary.json`, and `data/anomalies.json`, optionally prefixed by `R2_PREFIX`.

To make the public page read JSON from R2 instead of the same static host:

```bash
PUBLIC_DATA_BASE_URL="https://<r2-public-domain>/<optional-prefix>" npm run export
```

For GitHub Pages, set repository variables `PUBLIC_DATA_BASE_URL`, `R2_ACCOUNT_ID`, `R2_BUCKET`, and optional `R2_PREFIX`, plus repository secrets `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.

## Telegram Anomaly Channel

Dry-run anomaly detection never sends messages:

```bash
npm run anomaly:dry-run
```

To send exported anomaly events to a Telegram channel, configure:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_CHAT_ID="@your_channel"
npm run telegram:send-anomalies
```

The sender reads `public/data/anomalies.json` and only sends execution quality anomaly messages that were already exported. It does not send alpha, liquidation, whale, vault, or trading-signal content.

## Launch Status

Local collector, methodology, static page, daily summary generation, and Telegram anomaly sender are implemented. The public git repository and GitHub Pages benchmark are live. Public launch still requires Telegram channel credentials.

See `docs/release-checklist.md`.
See `docs/deployment.md` for the persistent deployment runbook.

## Methodology

See `public/methodology.html` after running the static export, and `docs/superpowers/specs/2026-05-29-perp-execution-quality-benchmark-design.md` for the design.
