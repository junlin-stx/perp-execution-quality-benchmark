# Perp Execution Quality Benchmark

Open collector and static benchmark for basic perp execution quality across Hyperliquid, Aevo, StandX, Aster, and edgeX.

Public repo: https://github.com/junlin-stx/perp-execution-quality-benchmark
Public benchmark: https://junlin-stx.github.io/perp-execution-quality-benchmark/

The first phase compares BTC, ETH, and SOL using:

- spread
- 10bp depth
- estimated slippage for a 100,000 USD taker order

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
- export static files every 300 seconds
- write SQLite data to `data/benchmark.sqlite`
- write static artifacts to `public/`

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
