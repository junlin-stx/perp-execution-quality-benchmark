# Perp Execution Quality Benchmark Design

## Goal

Build an open, reproducible perp execution quality benchmark that compares Hyperliquid, Aevo, StandX, Aster, and edgeX on BTC, ETH, and SOL using one shared methodology. The first phase is not a trading signal, paid product, or full web application. Its purpose is to test whether traders trust the data collection and calculations enough to cite, share, dispute, and improve them without dismissing the benchmark.

## Non-Goals

The benchmark will not include paid access, login, custom alerts, a fourth market, liquidation analysis, whale tracking, vault analysis, or venue-specific marketing treatment. StandX, Aster, and edgeX are execution venues in the same comparison grid as Hyperliquid, and Aevo.

## Scope

The first phase includes exactly these venues:

- Hyperliquid
- Aevo
- StandX
- Aster
- edgeX

The first phase includes exactly these markets:

- BTC
- ETH
- SOL

The first phase includes exactly these public metrics:

- Spread
- 10bp depth
- Estimated slippage for a 100,000 USD taker order

The public page keeps the venue x market x metric grid even when a venue does not list a market. As of the latest probe on 2026-05-29, StandX lists BTC-USD and ETH-USD but not SOL-USD. The StandX SOL cells will show `N/A: not listed` instead of substituting another market or hiding the row.

## Data Sources

Use public order book endpoints only. Do not use private accounts, privileged market maker feeds, UI scraping, or manually edited numbers.

| Venue | Markets | Source shape | Notes |
| --- | --- | --- | --- |
| Hyperliquid | BTC, ETH, SOL | `POST https://api.hyperliquid.xyz/info` with `type=l2Book` | Returns up to 20 levels per side. |
| Aevo | BTC-PERP, ETH-PERP, SOL-PERP | `GET https://api.aevo.xyz/orderbook` | Use public snapshot response by `instrument_name`. |
| StandX | BTC-USD, ETH-USD, SOL unavailable | `GET https://perps.standx.com/api/query_depth_book` | Sort bids descending and asks ascending client-side. Confirm available markets through `query_symbol_info`. |
| edgeX | BTCUSD, ETHUSD, SOLUSD | `GET https://pro.edgex.exchange/api/v1/public/quote/getDepth` | Public REST snapshot with fixed depth levels; request level 200. |

Every sample stores the source URL label, normalized venue, normalized market, venue-native symbol, fetch latency, source timestamp when available, local collection timestamp, level count, partial-data flag, and error reason when a fetch or normalization step fails.

## Metric Definitions

All metrics are computed from the normalized order book. Bids are sorted highest price first. Asks are sorted lowest price first. Size is base-asset quantity. USD notional is `price * size`.

### Mid Price

`mid = (best_bid + best_ask) / 2`

If either side is empty, all execution metrics for that snapshot are null and the snapshot is marked invalid.

### Spread

`spread_bp = ((best_ask - best_bid) / mid) * 10000`

Lower is better.

### 10bp Depth

Bid-side 10bp depth:

`sum(price * size for bid levels where price >= best_bid * (1 - 0.001))`

Ask-side 10bp depth:

`sum(price * size for ask levels where price <= best_ask * (1 + 0.001))`

Public 10bp depth:

`depth_10bp_total_usd = depth_10bp_bid_usd + depth_10bp_ask_usd`

Higher is better. The public table displays total depth, while exported JSON keeps bid and ask breakdowns.

### Estimated Slippage for 100,000 USD

For a buy taker order, consume ask levels from best ask upward until 100,000 USD notional is filled or book depth runs out.

For a sell taker order, consume bid levels from best bid downward until 100,000 USD notional is filled or book depth runs out.

Buy average execution price:

`buy_avg_px = total_quote_spent / total_base_bought`

Sell average execution price:

`sell_avg_px = total_quote_received / total_base_sold`

Buy slippage:

`buy_slippage_bp = ((buy_avg_px - mid) / mid) * 10000`

Sell slippage:

`sell_slippage_bp = ((mid - sell_avg_px) / mid) * 10000`

Public 100k estimated slippage:

`slippage_100k_avg_bp = (buy_slippage_bp + sell_slippage_bp) / 2`

Lower is better. If either side cannot fill 100,000 USD from the returned public book, mark that side as `insufficient_depth` and exclude the venue-market snapshot from "best venue" rankings for that metric. The public table should show `insufficient public depth`, not zero.

## Collection Cadence

The collector runs every 30 to 60 seconds. The default interval is 60 seconds for reliability and public API politeness. A 30 second interval is allowed through configuration after rate-limit behavior is verified.

Each collection round attempts all supported venue-market pairs. It records unavailable venue-market pairs as availability rows without hitting unsupported endpoints on every loop. For StandX SOL, the collector checks symbol availability periodically through the market metadata endpoint and marks execution metrics as not listed until SOL appears in the public symbol list.

## Storage

Use SQLite for phase one. The database is append-only and lives at `data/benchmark.sqlite` by default.

Core tables:

- `venue_market_status`: one row per venue-market, including supported, not listed, or disabled status.
- `orderbook_snapshots`: one row per venue-market collection attempt, including raw collection metadata and fetch status.
- `execution_metrics`: one row per successful normalized snapshot, including spread, 10bp depth, 100k slippage, side breakdowns, and ranking eligibility flags.
- `daily_summaries`: generated public summary text and source aggregate metadata.
- `anomaly_events`: Telegram-eligible execution quality anomalies with dedupe keys.

Raw full books are not stored in SQLite by default to keep the repo lightweight. For auditability, each snapshot stores top-of-book, level counts, and metric inputs. A debug mode can write compressed raw books to ignored local files when investigating adapter bugs.

## Static Public Artifacts

Every 5 minutes, an export job reads SQLite and writes static files under `public/`.

Required files:

- `public/index.html`: static benchmark page.
- `public/methodology.html`: methodology and limitations page.
- `public/data/latest.json`: latest grid data.
- `public/data/history-7d.json`: 7 day history for charting.
- `public/data/daily-summary.json`: latest daily summaries.
- `public/data/anomalies.json`: recent anomaly events.

The static page displays:

- Latest venue x 3 market x 3 metric grid.
- `N/A: not listed` states for unavailable venue-market pairs.
- 7 day history for each metric and market.
- Data freshness, failed fetch counts, and methodology links.
- Equal visual treatment for StandX and all other venues.

The page should be static and inspectable. It should not require a backend, login, paid plan, or per-user settings.

## Daily Summary

Generate one public summary per UTC day. UTC is used because the intended audience is global and it avoids ambiguity around exchange-local or operator-local dates.

The summary ranks venues by the median daily 100,000 USD taker slippage for each market, excluding venue-market pairs marked not listed or insufficient public depth.

Example format:


If a venue-market is not listed, the summary says so plainly:

`StandX SOL was not listed in the public StandX perps symbol list during the UTC day.`

## Telegram Anomaly Channel

Telegram is phase-one distribution, not a custom alerting product.

Only execution quality anomalies are eligible:

- A venue-market 100k slippage is worse than its 7 day same-market median by a configured bp threshold for multiple consecutive samples.
- A venue-market spread is worse than its 7 day same-market median by a configured bp threshold for multiple consecutive samples.
- A venue-market public order book cannot fill 100,000 USD after previously being fillable.
- A listed venue-market has repeated fetch or normalization failures.

Do not send alpha, liquidation, whale, vault, funding trade, or prediction messages. Deduplicate anomaly messages by venue, market, metric, and anomaly window.

## Architecture

The first implementation has five bounded units:

1. Exchange adapters fetch public order books and normalize them.
2. Pure metric functions calculate spread, 10bp depth, and 100k estimated slippage.
3. SQLite storage appends collection results and queryable aggregates.
4. Export jobs write static JSON, methodology, and HTML artifacts.
5. Summary and anomaly jobs derive daily text and Telegram-ready events from stored metrics.

This structure keeps the collector testable and makes the public output reproducible. The static page consumes generated JSON and does not know how each venue API works.

## Error Handling

Adapter failures, HTTP failures, schema mismatches, unavailable symbols, empty books, crossed books, and insufficient public depth are first-class states. They are stored and displayed instead of being silently dropped.

Ranking rules:

- Valid metric values can rank.
- Not listed venue-markets cannot rank.
- Failed snapshots cannot rank.
- Insufficient public depth cannot rank for the 100k slippage metric.
- A venue is never given a marketing exception.

## Testing

Tests should cover:

- Order book sorting and normalization.
- Spread calculation.
- 10bp depth calculation.
- 100,000 USD taker fill simulation for buy and sell.
- Insufficient depth states.
- SQLite schema and append behavior.
- Static JSON export shape.
- Daily summary ranking text.
- Anomaly dedupe behavior.

Live endpoint checks are useful smoke tests, but deterministic unit tests should use recorded fixtures.

## Verification Before Public Launch

Before calling the benchmark public, verify:

- One-shot collector succeeds against all currently listed venue-market pairs.
- StandX SOL is shown as not listed rather than silently missing.
- Static export generates all required files.
- Methodology page includes formulas, source endpoints, cadence, and comparability limits.
- Daily summary generation works from seeded or real data.
- Telegram anomaly dry run emits only execution quality messages.
- The public page can be opened from disk or a static server and shows latest plus 7 day history.

## Success Criteria

After four weeks, continue only if traders treat the benchmark as credible enough to cite, repost, challenge with better data, or critique specific methodology choices without rejecting the project as marketing or a black-box ranking.
