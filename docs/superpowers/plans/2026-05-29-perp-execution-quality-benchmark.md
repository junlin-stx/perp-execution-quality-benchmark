# Perp Execution Quality Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first public perp execution quality benchmark for Hyperliquid, Aevo, StandX, Aster, and edgeX across BTC, ETH, and SOL with spread, 10bp depth, and 100,000 USD estimated slippage.

**Architecture:** Implement a collector-first TypeScript project. Venue adapters normalize public order books, pure metric functions compute execution quality, SQLite stores append-only samples, and export jobs generate static public HTML/JSON plus daily summary and Telegram anomaly dry-run output.

**Tech Stack:** Node 22, TypeScript, `node:sqlite`, Vitest, TSX, static HTML/CSS/JavaScript.

---

## File Structure

- Create `package.json`: scripts for test, typecheck, collect, export, summary, anomaly dry-run.
- Create `tsconfig.json`: NodeNext TypeScript config.
- Create `.gitignore`: ignore dependencies, SQLite files, and generated debug books.
- Create `README.md`: purpose, non-goals, install, commands, and public methodology link.
- Create `src/config/markets.ts`: fixed venue, market, symbol, and source metadata.
- Create `src/types/orderbook.ts`: shared normalized order book and metric types.
- Create `src/metrics/orderbook.ts`: pure spread, 10bp depth, and 100k slippage functions.
- Create `src/exchanges/http.ts`: fetch helper with latency and JSON parsing.
- Create `src/exchanges/hyperliquid.ts`: Hyperliquid `l2Book` adapter.
- Create `src/exchanges/aevo.ts`: Aevo orderbook adapter.
- Create `src/exchanges/standx.ts`: StandX depth adapter and symbol availability adapter.
- Create `src/exchanges/index.ts`: adapter registry and collection target resolver.
- Create `src/storage/sqlite.ts`: schema, inserts, queries, and seed helpers.
- Create `src/collector/run.ts`: one collection round and scheduler.
- Create `src/cli.ts`: CLI entry point for collection.
- Create `src/export/static.ts`: latest/history JSON and static HTML generation.
- Create `src/export/cli.ts`: export CLI entry point.
- Create `src/summary/daily.ts`: UTC daily summary aggregation and wording.
- Create `src/summary/cli.ts`: summary CLI entry point.
- Create `src/anomaly/rules.ts`: anomaly detection and dedupe keys.
- Create `src/anomaly/cli.ts`: Telegram dry-run output.
- Create `tests/metrics/orderbook.test.ts`: deterministic metric tests.
- Create `tests/storage/sqlite.test.ts`: schema and append tests.
- Create `tests/export/static.test.ts`: static JSON/HTML export shape tests.
- Create `tests/summary/daily.test.ts`: daily wording and ranking tests.
- Create `tests/anomaly/rules.test.ts`: anomaly threshold and dedupe tests.

## Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Create package manifest**

Create `package.json`:

```json
{
  "name": "perp-execution-quality-benchmark",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "collect": "tsx src/cli.ts",
    "export": "tsx src/export/cli.ts",
    "summary": "tsx src/summary/cli.ts",
    "anomaly:dry-run": "tsx src/anomaly/cli.ts"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
dist/
data/*.sqlite
data/*.sqlite-*
data/debug-books/
public/data/*.json
.DS_Store
```

- [ ] **Step 4: Create README**

Create `README.md`:

```markdown
# Perp Execution Quality Benchmark

Open collector and static benchmark for basic perp execution quality across Hyperliquid, Aevo, StandX, Aster, and edgeX.

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

## Methodology

See `public/methodology.html` after running the static export, and `docs/superpowers/specs/2026-05-29-perp-execution-quality-benchmark-design.md` for the design.
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits 0.

- [ ] **Step 6: Verify empty skeleton**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck succeeds; Vitest reports no tests or passes once tests exist.

- [ ] **Step 7: Commit skeleton**

```bash
git add package.json package-lock.json tsconfig.json .gitignore README.md
git commit -m "chore: initialize benchmark project"
```

## Task 2: Fixed Markets and Shared Types

**Files:**
- Create: `src/config/markets.ts`
- Create: `src/types/orderbook.ts`
- Test: `tests/config/markets.test.ts`

- [ ] **Step 1: Write fixed market tests**

Create `tests/config/markets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectionTargets, markets, venues } from "../../src/config/markets.js";

describe("fixed benchmark universe", () => {
  it("keeps exactly 6 venues and 3 markets", () => {
    expect(markets).toEqual(["BTC", "ETH", "SOL"]);
  });

  it("marks StandX SOL as not listed without replacing it", () => {
    const target = collectionTargets.find((item) => item.venue === "standx" && item.market === "SOL");
    expect(target).toMatchObject({ status: "not_listed", symbol: "SOL-USD" });
  });
});
```

- [ ] **Step 2: Run market test to verify it fails**

Run:

```bash
npm test -- tests/config/markets.test.ts
```

Expected: FAIL because `src/config/markets.ts` does not exist.

- [ ] **Step 3: Implement fixed config**

Create `src/config/markets.ts`:

```ts
export const markets = ["BTC", "ETH", "SOL"] as const;

export type Venue = (typeof venues)[number];
export type Market = (typeof markets)[number];
export type VenueMarketStatus = "listed" | "not_listed";

export interface CollectionTarget {
  venue: Venue;
  market: Market;
  symbol: string;
  status: VenueMarketStatus;
  source: string;
}

export const collectionTargets: CollectionTarget[] = [
  { venue: "hyperliquid", market: "BTC", symbol: "BTC", status: "listed", source: "hyperliquid_l2_book" },
  { venue: "hyperliquid", market: "ETH", symbol: "ETH", status: "listed", source: "hyperliquid_l2_book" },
  { venue: "hyperliquid", market: "SOL", symbol: "SOL", status: "listed", source: "hyperliquid_l2_book" },
  { venue: "aevo", market: "BTC", symbol: "BTC-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "aevo", market: "ETH", symbol: "ETH-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "aevo", market: "SOL", symbol: "SOL-PERP", status: "listed", source: "aevo_orderbook" },
  { venue: "standx", market: "BTC", symbol: "BTC-USD", status: "listed", source: "standx_depth_book" },
  { venue: "standx", market: "ETH", symbol: "ETH-USD", status: "listed", source: "standx_depth_book" },
  { venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", source: "standx_symbol_info" }
];
```

- [ ] **Step 4: Implement shared types**

Create `src/types/orderbook.ts`:

```ts
import type { Market, Venue } from "../config/markets.js";

export interface BookLevel {
  price: number;
  size: number;
}

export interface NormalizedOrderBook {
  venue: Venue;
  market: Market;
  symbol: string;
  source: string;
  localTimestampMs: number;
  sourceTimestampMs?: number;
  latencyMs: number;
  bids: BookLevel[];
  asks: BookLevel[];
  isPartial: boolean;
}

export interface SideSlippage {
  side: "buy" | "sell";
  filledUsd: number;
  averagePrice: number | null;
  slippageBp: number | null;
  insufficientDepth: boolean;
}

export interface ExecutionMetrics {
  venue: Venue;
  market: Market;
  symbol: string;
  localTimestampMs: number;
  midPrice: number | null;
  spreadBp: number | null;
  depth10BpBidUsd: number | null;
  depth10BpAskUsd: number | null;
  depth10BpTotalUsd: number | null;
  buySlippage100kBp: number | null;
  sellSlippage100kBp: number | null;
  avgSlippage100kBp: number | null;
  insufficientDepth100k: boolean;
  valid: boolean;
  error: string | null;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/config/markets.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit fixed config and types**

```bash
git add src/config/markets.ts src/types/orderbook.ts tests/config/markets.test.ts
git commit -m "feat: define benchmark universe"
```

## Task 3: Pure Metric Functions

**Files:**
- Create: `src/metrics/orderbook.ts`
- Test: `tests/metrics/orderbook.test.ts`

- [ ] **Step 1: Write metric tests**

Create `tests/metrics/orderbook.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateExecutionMetrics, estimateTakerSlippage, sumDepthWithinBp } from "../../src/metrics/orderbook.js";
import type { NormalizedOrderBook } from "../../src/types/orderbook.js";

const book: NormalizedOrderBook = {
  market: "BTC",
  source: "fixture",
  localTimestampMs: 1,
  latencyMs: 12,
  bids: [
    { price: 100, size: 500 },
    { price: 99.95, size: 400 },
    { price: 99.8, size: 1000 }
  ],
  asks: [
    { price: 100.1, size: 500 },
    { price: 100.15, size: 400 },
    { price: 100.4, size: 1000 }
  ],
  isPartial: false
};

describe("orderbook metrics", () => {
  it("calculates spread and 10bp depth", () => {
    const metrics = calculateExecutionMetrics(book);
    expect(metrics.midPrice).toBeCloseTo(100.05);
    expect(metrics.spreadBp).toBeCloseTo(9.995);
    expect(metrics.depth10BpBidUsd).toBeCloseTo(89980);
    expect(metrics.depth10BpAskUsd).toBeCloseTo(90110);
    expect(metrics.depth10BpTotalUsd).toBeCloseTo(180090);
  });

  it("simulates 100k buy and sell taker slippage", () => {
    const buy = estimateTakerSlippage(book.asks, "buy", 100_000, 100.05);
    const sell = estimateTakerSlippage(book.bids, "sell", 100_000, 100.05);
    expect(buy.insufficientDepth).toBe(false);
    expect(sell.insufficientDepth).toBe(false);
    expect(buy.slippageBp).toBeGreaterThan(0);
    expect(sell.slippageBp).toBeGreaterThan(0);
  });

  it("marks insufficient depth instead of returning zero", () => {
    const result = estimateTakerSlippage([{ price: 100, size: 1 }], "buy", 100_000, 100);
    expect(result.insufficientDepth).toBe(true);
    expect(result.slippageBp).toBeNull();
  });

  it("sums depth inside a bp band", () => {
    expect(sumDepthWithinBp(book.bids, "bid", 100, 10)).toBeCloseTo(89980);
    expect(sumDepthWithinBp(book.asks, "ask", 100.1, 10)).toBeCloseTo(90110);
  });
});
```

- [ ] **Step 2: Run metric test to verify it fails**

Run:

```bash
npm test -- tests/metrics/orderbook.test.ts
```

Expected: FAIL because metric functions do not exist.

- [ ] **Step 3: Implement metrics**

Create `src/metrics/orderbook.ts`:

```ts
import type { BookLevel, ExecutionMetrics, NormalizedOrderBook, SideSlippage } from "../types/orderbook.js";

export function sortBids(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => b.price - a.price);
}

export function sortAsks(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => a.price - b.price);
}

export function sumDepthWithinBp(levels: BookLevel[], side: "bid" | "ask", bestPrice: number, bp: number): number {
  const distance = bp / 10_000;
  const limit = side === "bid" ? bestPrice * (1 - distance) : bestPrice * (1 + distance);
  return levels.reduce((sum, level) => {
    const inside = side === "bid" ? level.price >= limit : level.price <= limit;
    return inside ? sum + level.price * level.size : sum;
  }, 0);
}

export function estimateTakerSlippage(
  levels: BookLevel[],
  side: "buy" | "sell",
  targetUsd: number,
  midPrice: number
): SideSlippage {
  let remainingUsd = targetUsd;
  let totalBase = 0;
  let totalQuote = 0;

  for (const level of levels) {
    if (remainingUsd <= 0) break;
    const levelUsd = level.price * level.size;
    const takeUsd = Math.min(levelUsd, remainingUsd);
    const takeBase = takeUsd / level.price;
    totalQuote += takeUsd;
    totalBase += takeBase;
    remainingUsd -= takeUsd;
  }

  if (remainingUsd > 0 || totalBase === 0) {
    return { side, filledUsd: targetUsd - remainingUsd, averagePrice: null, slippageBp: null, insufficientDepth: true };
  }

  const averagePrice = totalQuote / totalBase;
  const slippageBp = side === "buy"
    ? ((averagePrice - midPrice) / midPrice) * 10_000
    : ((midPrice - averagePrice) / midPrice) * 10_000;

  return { side, filledUsd: targetUsd, averagePrice, slippageBp, insufficientDepth: false };
}

export function calculateExecutionMetrics(book: NormalizedOrderBook, targetUsd = 100_000): ExecutionMetrics {
  const bids = sortBids(book.bids);
  const asks = sortAsks(book.asks);
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;

  if (bestBid === undefined || bestAsk === undefined || bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
    return emptyMetrics(book, "invalid_orderbook");
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const buy = estimateTakerSlippage(asks, "buy", targetUsd, midPrice);
  const sell = estimateTakerSlippage(bids, "sell", targetUsd, midPrice);
  const insufficientDepth100k = buy.insufficientDepth || sell.insufficientDepth;
  const avgSlippage100kBp = insufficientDepth100k || buy.slippageBp === null || sell.slippageBp === null
    ? null
    : (buy.slippageBp + sell.slippageBp) / 2;

  const depth10BpBidUsd = sumDepthWithinBp(bids, "bid", bestBid, 10);
  const depth10BpAskUsd = sumDepthWithinBp(asks, "ask", bestAsk, 10);

  return {
    venue: book.venue,
    market: book.market,
    symbol: book.symbol,
    localTimestampMs: book.localTimestampMs,
    midPrice,
    spreadBp: ((bestAsk - bestBid) / midPrice) * 10_000,
    depth10BpBidUsd,
    depth10BpAskUsd,
    depth10BpTotalUsd: depth10BpBidUsd + depth10BpAskUsd,
    buySlippage100kBp: buy.slippageBp,
    sellSlippage100kBp: sell.slippageBp,
    avgSlippage100kBp,
    insufficientDepth100k,
    valid: true,
    error: null
  };
}

function emptyMetrics(book: NormalizedOrderBook, error: string): ExecutionMetrics {
  return {
    venue: book.venue,
    market: book.market,
    symbol: book.symbol,
    localTimestampMs: book.localTimestampMs,
    midPrice: null,
    spreadBp: null,
    depth10BpBidUsd: null,
    depth10BpAskUsd: null,
    depth10BpTotalUsd: null,
    buySlippage100kBp: null,
    sellSlippage100kBp: null,
    avgSlippage100kBp: null,
    insufficientDepth100k: false,
    valid: false,
    error
  };
}
```

- [ ] **Step 4: Run metric tests**

Run:

```bash
npm test -- tests/metrics/orderbook.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit metrics**

```bash
git add src/metrics/orderbook.ts tests/metrics/orderbook.test.ts
git commit -m "feat: calculate execution quality metrics"
```

## Task 4: SQLite Storage

**Files:**
- Create: `src/storage/sqlite.ts`
- Test: `tests/storage/sqlite.test.ts`

- [ ] **Step 1: Write storage test**

Create `tests/storage/sqlite.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BenchmarkDb } from "../../src/storage/sqlite.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("BenchmarkDb", () => {
  it("creates schema, stores status, snapshots, and metrics", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-bench-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    db.upsertVenueMarketStatus({ venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", reason: "not in symbol list" });
    const snapshotId = db.insertSnapshot({
      market: "BTC",
      localTimestampMs: 1,
      sourceTimestampMs: 2,
      latencyMs: 10,
      bidCount: 2,
      askCount: 2,
      isPartial: false,
      status: "ok",
      error: null
    });
    db.insertMetrics(snapshotId, {
      market: "BTC",
      localTimestampMs: 1,
      midPrice: 100,
      spreadBp: 1,
      depth10BpBidUsd: 1000,
      depth10BpAskUsd: 900,
      depth10BpTotalUsd: 1900,
      buySlippage100kBp: 2,
      sellSlippage100kBp: 3,
      avgSlippage100kBp: 2.5,
      insufficientDepth100k: false,
      valid: true,
      error: null
    });
    expect(db.getLatestGrid()).toHaveLength(2);
    db.close();
  });
});
```

- [ ] **Step 2: Run storage test to verify it fails**

Run:

```bash
npm test -- tests/storage/sqlite.test.ts
```

Expected: FAIL because `BenchmarkDb` does not exist.

- [ ] **Step 3: Implement SQLite storage**

Create `src/storage/sqlite.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Market, Venue, VenueMarketStatus } from "../config/markets.js";
import type { ExecutionMetrics } from "../types/orderbook.js";

export interface VenueMarketStatusRow {
  venue: Venue;
  market: Market;
  symbol: string;
  status: VenueMarketStatus;
  reason: string | null;
}

export interface SnapshotInsert {
  venue: Venue;
  market: Market;
  symbol: string;
  source: string;
  localTimestampMs: number;
  sourceTimestampMs: number | null;
  latencyMs: number;
  bidCount: number;
  askCount: number;
  isPartial: boolean;
  status: "ok" | "failed" | "not_listed";
  error: string | null;
}

export class BenchmarkDb {
  private db: DatabaseSync;

  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
  }

  initialize(): void {
    this.db.exec(`
      create table if not exists venue_market_status (
        venue text not null,
        market text not null,
        symbol text not null,
        status text not null,
        reason text,
        updated_at_ms integer not null,
        primary key (venue, market)
      );
      create table if not exists orderbook_snapshots (
        id integer primary key autoincrement,
        venue text not null,
        market text not null,
        symbol text not null,
        source text not null,
        local_timestamp_ms integer not null,
        source_timestamp_ms integer,
        latency_ms integer not null,
        bid_count integer not null,
        ask_count integer not null,
        is_partial integer not null,
        status text not null,
        error text
      );
      create table if not exists execution_metrics (
        snapshot_id integer primary key,
        venue text not null,
        market text not null,
        symbol text not null,
        local_timestamp_ms integer not null,
        mid_price real,
        spread_bp real,
        depth_10bp_bid_usd real,
        depth_10bp_ask_usd real,
        depth_10bp_total_usd real,
        buy_slippage_100k_bp real,
        sell_slippage_100k_bp real,
        avg_slippage_100k_bp real,
        insufficient_depth_100k integer not null,
        valid integer not null,
        error text,
        foreign key (snapshot_id) references orderbook_snapshots(id)
      );
    `);
  }

  upsertVenueMarketStatus(row: VenueMarketStatusRow): void {
    this.db.prepare(`
      insert into venue_market_status (venue, market, symbol, status, reason, updated_at_ms)
      values (?, ?, ?, ?, ?, ?)
      on conflict(venue, market) do update set
        symbol = excluded.symbol,
        status = excluded.status,
        reason = excluded.reason,
        updated_at_ms = excluded.updated_at_ms
    `).run(row.venue, row.market, row.symbol, row.status, row.reason, Date.now());
  }

  insertSnapshot(row: SnapshotInsert): number {
    const result = this.db.prepare(`
      insert into orderbook_snapshots (
        venue, market, symbol, source, local_timestamp_ms, source_timestamp_ms, latency_ms,
        bid_count, ask_count, is_partial, status, error
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.venue, row.market, row.symbol, row.source, row.localTimestampMs, row.sourceTimestampMs,
      row.latencyMs, row.bidCount, row.askCount, row.isPartial ? 1 : 0, row.status, row.error
    );
    return Number(result.lastInsertRowid);
  }

  insertMetrics(snapshotId: number, metrics: ExecutionMetrics): void {
    this.db.prepare(`
      insert into execution_metrics (
        snapshot_id, venue, market, symbol, local_timestamp_ms, mid_price, spread_bp,
        depth_10bp_bid_usd, depth_10bp_ask_usd, depth_10bp_total_usd,
        buy_slippage_100k_bp, sell_slippage_100k_bp, avg_slippage_100k_bp,
        insufficient_depth_100k, valid, error
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshotId, metrics.venue, metrics.market, metrics.symbol, metrics.localTimestampMs,
      metrics.midPrice, metrics.spreadBp, metrics.depth10BpBidUsd, metrics.depth10BpAskUsd,
      metrics.depth10BpTotalUsd, metrics.buySlippage100kBp, metrics.sellSlippage100kBp,
      metrics.avgSlippage100kBp, metrics.insufficientDepth100k ? 1 : 0, metrics.valid ? 1 : 0,
      metrics.error
    );
  }

  getLatestGrid(): unknown[] {
    return this.db.prepare(`
      select venue, market, symbol, status, reason, null as spread_bp, null as depth_10bp_total_usd, null as avg_slippage_100k_bp
      from venue_market_status
      union all
      select venue, market, symbol, 'listed' as status, null as reason, spread_bp, depth_10bp_total_usd, avg_slippage_100k_bp
      from execution_metrics
      where snapshot_id in (select max(snapshot_id) from execution_metrics group by venue, market)
    `).all();
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run storage tests**

Run:

```bash
npm test -- tests/storage/sqlite.test.ts
npm run typecheck
```

Expected: PASS. If Node requires the experimental SQLite flag, update scripts to `node --experimental-sqlite` via `tsx` runner command and rerun.

- [ ] **Step 5: Commit storage**

```bash
git add src/storage/sqlite.ts tests/storage/sqlite.test.ts
git commit -m "feat: store benchmark samples in sqlite"
```

## Task 5: Exchange Adapters and Collector

**Files:**
- Create: `src/exchanges/http.ts`
- Create: `src/exchanges/hyperliquid.ts`
- Create: `src/exchanges/aevo.ts`
- Create: `src/exchanges/standx.ts`
- Create: `src/exchanges/index.ts`
- Create: `src/collector/run.ts`
- Create: `src/cli.ts`
- Test: `tests/exchanges/normalize.test.ts`

- [ ] **Step 1: Write adapter normalization tests**

Create `tests/exchanges/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeAevoBook } from "../../src/exchanges/aevo.js";
import { normalizeHyperliquidBook } from "../../src/exchanges/hyperliquid.js";
import { normalizeStandxBook } from "../../src/exchanges/standx.js";

describe("adapter normalization", () => {
    expect(book.bids[0]).toEqual({ price: 100, size: 2 });
    expect(book.asks[0]).toEqual({ price: 101, size: 3 });
  });

  it("normalizes Hyperliquid level objects", () => {
    const book = normalizeHyperliquidBook("ETH", "ETH", { time: 2, levels: [[{ px: "99", sz: "4" }], [{ px: "100", sz: "5" }]] }, 1, 5);
    expect(book.bids[0]).toEqual({ price: 99, size: 4 });
    expect(book.asks[0]).toEqual({ price: 100, size: 5 });
  });

  it("normalizes Aevo array levels", () => {
    const book = normalizeAevoBook("SOL", "SOL-PERP", { last_updated: "2", bids: [["10", "6"]], asks: [["10.1", "7"]] }, 1, 5);
    expect(book.bids[0]).toEqual({ price: 10, size: 6 });
    expect(book.asks[0]).toEqual({ price: 10.1, size: 7 });
  });

  it("sorts StandX bids and asks", () => {
    const book = normalizeStandxBook("BTC", "BTC-USD", { time: 2, bids: [["99", "1"], ["100", "1"]], asks: [["102", "1"], ["101", "1"]] }, 1, 5);
    expect(book.bids.map((level) => level.price)).toEqual([100, 99]);
    expect(book.asks.map((level) => level.price)).toEqual([101, 102]);
  });
});
```

- [ ] **Step 2: Run adapter test to verify it fails**

Run:

```bash
npm test -- tests/exchanges/normalize.test.ts
```

Expected: FAIL because adapter files do not exist.

- [ ] **Step 3: Implement adapters and registry**

Implement the files with these exported functions and behavior:

```ts
// src/exchanges/index.ts
export interface ExchangeAdapter {
  fetchOrderBook(target: CollectionTarget): Promise<NormalizedOrderBook>;
}
export function getAdapter(venue: Venue): ExchangeAdapter;
```

Each adapter must:

- fetch only its public source endpoint;
- normalize string numbers to finite `number`;
- sort bids descending and asks ascending;
- set `isPartial` to `true` when endpoint level limits are known to be partial, including Hyperliquid's 20-level book;
- throw a clear `Error` on malformed response.

The StandX adapter must also expose:

```ts
export async function fetchStandxListedSymbols(): Promise<Set<string>>;
```

The collector will use it to keep `SOL-USD` as `not_listed`.

- [ ] **Step 4: Implement collector round and CLI**

Create `src/collector/run.ts` with:

```ts
export interface CollectorOptions {
  dbPath: string;
  once: boolean;
  intervalSeconds: number;
}

export async function runCollectionRound(db: BenchmarkDb): Promise<{ collected: number; failed: number; notListed: number }>;
export async function runCollector(options: CollectorOptions): Promise<void>;
```

Create `src/cli.ts` to parse:

- `--once`
- `--interval <seconds>`
- `--db <path>`

Default DB path: `data/benchmark.sqlite`. Default interval: `60`.

- [ ] **Step 5: Run adapter tests and typecheck**

Run:

```bash
npm test -- tests/exchanges/normalize.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Run live one-shot smoke test**

Run:

```bash
npm run collect -- --once
```

Expected: command exits 0 and prints a summary like:

```text
collected=11 failed=0 not_listed=1
```

`not_listed=1` is StandX SOL.

- [ ] **Step 7: Commit adapters and collector**

```bash
git add src/exchanges src/collector src/cli.ts tests/exchanges/normalize.test.ts
git commit -m "feat: collect public perp orderbooks"
```

## Task 6: Static Export and Methodology Page

**Files:**
- Create: `src/export/static.ts`
- Create: `src/export/cli.ts`
- Test: `tests/export/static.test.ts`

- [ ] **Step 1: Write static export test**

Create `tests/export/static.test.ts`:

```ts
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportStaticSite } from "../../src/export/static.js";
import { BenchmarkDb } from "../../src/storage/sqlite.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("static export", () => {
  it("writes index, methodology, latest, history, summary, and anomalies files", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-export-"));
    const db = new BenchmarkDb(join(tempDir, "test.sqlite"));
    db.initialize();
    db.upsertVenueMarketStatus({ venue: "standx", market: "SOL", symbol: "SOL-USD", status: "not_listed", reason: "not in symbol list" });
    exportStaticSite(db, join(tempDir, "public"));
    expect(readFileSync(join(tempDir, "public", "index.html"), "utf8")).toContain("Perp Execution Quality");
    expect(readFileSync(join(tempDir, "public", "methodology.html"), "utf8")).toContain("100,000 USD");
    expect(readFileSync(join(tempDir, "public", "data", "latest.json"), "utf8")).toContain("standx");
    expect(readFileSync(join(tempDir, "public", "data", "history-7d.json"), "utf8")).toContain("[]");
    db.close();
  });
});
```

- [ ] **Step 2: Run export test to verify it fails**

Run:

```bash
npm test -- tests/export/static.test.ts
```

Expected: FAIL because export module does not exist.

- [ ] **Step 3: Implement static export**

Create `src/export/static.ts` with:

```ts
export function exportStaticSite(db: BenchmarkDb, outputDir = "public"): void;
```

It must create:

- `index.html`
- `methodology.html`
- `data/latest.json`
- `data/history-7d.json`
- `data/daily-summary.json`
- `data/anomalies.json`

The generated methodology page must include:

- spread formula;
- 10bp depth formula;
- 100,000 USD taker slippage formula;
- public source endpoints;
- 30-60 second collection cadence;
- 5 minute static export cadence;
- StandX SOL not listed rule;
- Hyperliquid 20-level limitation;
- no alpha/liquidation/whale/vault scope.

- [ ] **Step 4: Implement export CLI**

Create `src/export/cli.ts`:

```ts
import { BenchmarkDb } from "../storage/sqlite.js";
import { exportStaticSite } from "./static.js";

const dbPath = process.argv.includes("--db")
  ? process.argv[process.argv.indexOf("--db") + 1]
  : "data/benchmark.sqlite";
const outDir = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "public";

const db = new BenchmarkDb(dbPath);
db.initialize();
exportStaticSite(db, outDir);
db.close();
console.log(`exported static benchmark to ${outDir}`);
```

- [ ] **Step 5: Run export tests and command**

Run:

```bash
npm test -- tests/export/static.test.ts
npm run export
```

Expected: PASS and `public/` contains all required static files.

- [ ] **Step 6: Commit static export**

```bash
git add src/export tests/export/static.test.ts public/index.html public/methodology.html
git commit -m "feat: export static benchmark pages"
```

## Task 7: Daily Summary

**Files:**
- Create: `src/summary/daily.ts`
- Create: `src/summary/cli.ts`
- Test: `tests/summary/daily.test.ts`

- [ ] **Step 1: Write daily summary test**

Create `tests/summary/daily.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDailySummaryText } from "../../src/summary/daily.js";

describe("daily summary", () => {
  it("ranks venues by median 100k slippage and states not-listed markets", () => {
    const lines = buildDailySummaryText("2026-05-28", "BTC", [
      { venue: "hyperliquid", market: "BTC", medianSlippageBp: 1.6, status: "listed" },
      { venue: "aevo", market: "BTC", medianSlippageBp: 3.3, status: "listed" },
      { venue: "standx", market: "BTC", medianSlippageBp: 4.2, status: "listed" }
    ]);
    expect(lines).toContain("Hyperliquid +0.40 bp");
  });

  it("mentions StandX SOL as not listed", () => {
    const text = buildDailySummaryText("2026-05-28", "SOL", [
      { venue: "standx", market: "SOL", medianSlippageBp: null, status: "not_listed" }
    ]);
    expect(text).toContain("StandX SOL was not listed");
  });
});
```

- [ ] **Step 2: Run summary test to verify it fails**

Run:

```bash
npm test -- tests/summary/daily.test.ts
```

Expected: FAIL because summary module does not exist.

- [ ] **Step 3: Implement daily summary**

Create `src/summary/daily.ts` with:

```ts
export interface DailyVenueMetric {
  venue: Venue;
  market: Market;
  medianSlippageBp: number | null;
  status: "listed" | "not_listed" | "insufficient_depth";
}

export function buildDailySummaryText(utcDate: string, market: Market, rows: DailyVenueMetric[]): string;
export function generateDailySummaries(db: BenchmarkDb, utcDate: string): string[];
```

Rules:

- rank only listed rows with non-null `medianSlippageBp`;
- lowest median slippage is best;
- express other venues as `+X.XX bp` relative to best;
- include not-listed rows as plain language;
- use UTC date windows.

- [ ] **Step 4: Implement summary CLI**

Create `src/summary/cli.ts` to accept `--date YYYY-MM-DD` and `--db data/benchmark.sqlite`, generate summaries, persist them through storage helper methods, and print each line.

- [ ] **Step 5: Run summary tests**

Run:

```bash
npm test -- tests/summary/daily.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit summary**

```bash
git add src/summary tests/summary/daily.test.ts
git commit -m "feat: generate daily execution summary"
```

## Task 8: Telegram Anomaly Dry Run

**Files:**
- Create: `src/anomaly/rules.ts`
- Create: `src/anomaly/cli.ts`
- Test: `tests/anomaly/rules.test.ts`

- [ ] **Step 1: Write anomaly tests**

Create `tests/anomaly/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectAnomalies } from "../../src/anomaly/rules.js";

describe("anomaly rules", () => {
  it("detects repeated execution quality degradation", () => {
    const events = detectAnomalies([
      { venue: "aevo", market: "BTC", metric: "avg_slippage_100k_bp", value: 8, baseline: 2, timestampMs: 1 },
      { venue: "aevo", market: "BTC", metric: "avg_slippage_100k_bp", value: 9, baseline: 2, timestampMs: 2 },
      { venue: "aevo", market: "BTC", metric: "avg_slippage_100k_bp", value: 10, baseline: 2, timestampMs: 3 }
    ], { minConsecutive: 3, slippageBpDelta: 5, spreadBpDelta: 3 });
    expect(events).toHaveLength(1);
    expect(events[0].dedupeKey).toBe("aevo:BTC:avg_slippage_100k_bp:1-3");
  });

  it("does not produce non-execution messages", () => {
    const events = detectAnomalies([], { minConsecutive: 3, slippageBpDelta: 5, spreadBpDelta: 3 });
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run anomaly test to verify it fails**

Run:

```bash
npm test -- tests/anomaly/rules.test.ts
```

Expected: FAIL because anomaly module does not exist.

- [ ] **Step 3: Implement anomaly rules**

Create `src/anomaly/rules.ts`:

```ts
import type { Market, Venue } from "../config/markets.js";

export type AnomalyMetric = "avg_slippage_100k_bp" | "spread_bp" | "insufficient_depth_100k" | "fetch_failure";

export interface AnomalyPoint {
  venue: Venue;
  market: Market;
  metric: AnomalyMetric;
  value: number;
  baseline: number;
  timestampMs: number;
}

export interface AnomalyConfig {
  minConsecutive: number;
  slippageBpDelta: number;
  spreadBpDelta: number;
}

export interface AnomalyEvent {
  venue: Venue;
  market: Market;
  metric: AnomalyMetric;
  startTimestampMs: number;
  endTimestampMs: number;
  message: string;
  dedupeKey: string;
}

export function detectAnomalies(points: AnomalyPoint[], config: AnomalyConfig): AnomalyEvent[] {
  const grouped = new Map<string, AnomalyPoint[]>();
  for (const point of points) {
    const key = `${point.venue}:${point.market}:${point.metric}`;
    grouped.set(key, [...(grouped.get(key) ?? []), point]);
  }

  const events: AnomalyEvent[] = [];
  for (const [key, rows] of grouped) {
    const sorted = rows.sort((a, b) => a.timestampMs - b.timestampMs);
    const bad = sorted.filter((row) => row.value - row.baseline >= thresholdFor(row.metric, config));
    if (bad.length >= config.minConsecutive) {
      const window = bad.slice(0, config.minConsecutive);
      const first = window[0];
      const last = window[window.length - 1];
      events.push({
        venue: first.venue,
        market: first.market,
        metric: first.metric,
        startTimestampMs: first.timestampMs,
        endTimestampMs: last.timestampMs,
        message: `${first.market} ${first.venue} ${first.metric} degraded versus 7d baseline`,
        dedupeKey: `${key}:${first.timestampMs}-${last.timestampMs}`
      });
    }
  }
  return events;
}

function thresholdFor(metric: AnomalyMetric, config: AnomalyConfig): number {
  return metric === "spread_bp" ? config.spreadBpDelta : config.slippageBpDelta;
}
```

- [ ] **Step 4: Implement anomaly CLI**

Create `src/anomaly/cli.ts` to read recent metrics from SQLite, print Telegram-ready anomaly messages, and write nothing to Telegram. The output must be dry-run text only:

```text
[dry-run] BTC aevo avg_slippage_100k_bp degraded versus 7d baseline
```

- [ ] **Step 5: Run anomaly tests**

Run:

```bash
npm test -- tests/anomaly/rules.test.ts
npm run anomaly:dry-run
```

Expected: tests pass; dry run prints zero or more `[dry-run]` lines and never sends network messages to Telegram.

- [ ] **Step 6: Commit anomaly dry run**

```bash
git add src/anomaly tests/anomaly/rules.test.ts
git commit -m "feat: detect execution quality anomalies"
```

## Task 9: End-to-End Verification and Launch Readiness

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-29-perp-execution-quality-benchmark-design.md` only if verification uncovers a methodology correction.

- [ ] **Step 1: Run full deterministic verification**

Run:

```bash
npm test
npm run typecheck
```

Expected: all tests pass and typecheck exits 0.

- [ ] **Step 2: Run live collector smoke test**

Run:

```bash
npm run collect -- --once
```

Expected:

```text
collected=11 failed=0 not_listed=1
```

If a public endpoint is temporarily failing, rerun once. If it still fails, record the exact failing venue-market in README under a "Current endpoint status" section instead of weakening the methodology.

- [ ] **Step 3: Generate static artifacts**

Run:

```bash
npm run export
```

Expected files:

```text
public/index.html
public/methodology.html
public/data/latest.json
public/data/history-7d.json
public/data/daily-summary.json
public/data/anomalies.json
```

- [ ] **Step 4: Generate daily summary dry run**

Run:

```bash
npm run summary
```

Expected: one line per market where enough data exists, plus a plain StandX SOL not-listed sentence.

- [ ] **Step 5: Run Telegram anomaly dry run**

Run:

```bash
npm run anomaly:dry-run
```

Expected: output is prefixed with `[dry-run]` and contains only execution quality anomaly text.

- [ ] **Step 6: Inspect public methodology text**

Run:

```bash
```

Expected: each limitation and non-goal appears in the methodology page.

- [ ] **Step 7: Commit launch readiness docs**

```bash
git add README.md public/index.html public/methodology.html
git commit -m "docs: document benchmark verification"
```

## Plan Self-Review

- Spec coverage: collector, methodology page, static page, daily summary, Telegram anomaly dry run, exact venue/market/metric scope, non-goals, StandX SOL not-listed handling, UTC day, storage, error states, and verification are each mapped to tasks.
- Placeholder scan: no unresolved placeholder markers or vague fill-in steps are intentionally left.
- Type consistency: venue, market, status, normalized book, and metric names match across config, types, storage, collector, export, summary, and anomaly tasks.
