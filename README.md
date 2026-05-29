# Perp Execution Quality Benchmark

Open collector and static benchmark for basic perp execution quality across Hyperliquid, Binance Perps, Aevo, and StandX.

The first phase compares BTC, ETH, and SOL using:

- spread
- 10bp depth
- estimated slippage for a 100,000 USD taker order

This is not a trading signal, paid product, liquidation monitor, whale tracker, vault dashboard, or StandX marketing page.

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

## Methodology

See `public/methodology.html` after running the static export, and `docs/superpowers/specs/2026-05-29-perp-execution-quality-benchmark-design.md` for the design.
