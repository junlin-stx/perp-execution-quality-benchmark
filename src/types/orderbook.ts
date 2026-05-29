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
  buySlippage1mBp: number | null;
  sellSlippage1mBp: number | null;
  avgSlippage1mBp: number | null;
  insufficientDepth1m: boolean;
  valid: boolean;
  error: string | null;
}
