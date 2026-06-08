# Public Data Contract

The public site is a static benchmark. The JSON files under `public/data/` are the public API for traders, quants, newsletter writers, and community reviewers who want to cite or dispute the data.

There is no login, private feed, CSV export, or interactive API in this milestone. If you need tabular data, consume the JSON files directly and convert them locally.

## Files

- `data/latest.json`: latest target list and latest comparable metric rows.
- `data/health.json`: freshness, count, and per venue/market status summary.
- `data/history-7d.json`: 15 minute rollups from persistent SQLite history.
- `data/daily-summary.json`: copyable daily market notes generated from stored metrics.
- `data/anomalies.json`: public anomaly events that can be linked, quoted, or sent to Telegram.

## Freshness Semantics

- `generatedAt` is the time the JSON file was exported.
- `latestSampleTimestampMs` is the newest collected snapshot timestamp represented in health data.
- `latestSampleAgeSeconds` is computed at export time from `latestSampleTimestampMs`.
- `history-7d.json` is a rollup of stored SQLite samples, not a one-shot CI snapshot.
- Cache TTLs may differ by host. Treat `health.json` and `latest.json` as the freshness checks before citing a rank.

## Status Semantics

- `ok`: the latest public collection produced a comparable sample.
- `failed`: the latest public collection failed for that venue/market.
- `not_listed`: the target is intentionally tracked but not publicly listed, for example StandX `SOL-USD`.
- `insufficient_depth`: the public book did not provide enough depth for at least one tracked taker-size metric.
- `unavailable`: no recent public sample exists for a listed target.

Missing, failed, not-listed, and insufficient-depth states are part of the benchmark result. Consumers should not silently drop them.

## Metric Units

- `spread_bp`: basis points. Top-of-book signal only.
- `depth_3bp_total_usd`, `depth_5bp_total_usd`, `depth_10bp_total_usd`: two-sided USD notional depth inside each basis-point band.
- `avg_slippage_100k_bp`, `avg_slippage_1m_bp`: average estimated taker slippage in basis points for 100,000 USD and 1,000,000 USD orders.
- `sample_count`: number of raw samples rolled into a 15 minute history bucket.
- `insufficient_depth_100k_count` and `insufficient_depth_1m_count`: count of raw samples in the rollup bucket where the public book could not fill the target notional.

`null` means the metric is not comparable for that row or bucket.

## Ranking Semantics

Depth and estimated taker slippage are the primary comparable metrics. Spread stays visible because it is useful top-of-book context, but it is tick-size sensitive and is not used as the primary cross-venue ranking cue.

Hyperliquid and Aster are reference-only venues. They appear for context but are excluded from public `Best` calculations and daily benchmark winner summaries.

## Anomaly Feed

Each anomaly row includes:

- `dedupe_key`: stable event identity.
- `venue`, `market`, `metric`: affected venue/market/metric.
- `start_timestamp_ms`, `end_timestamp_ms`: event window.
- `baseline`: comparison baseline when available.
- `observed_value`: observed degraded value when available.
- `message`: short public explanation.

Old anomaly rows may have `baseline` or `observed_value` as `null` until regenerated with the newer schema.
