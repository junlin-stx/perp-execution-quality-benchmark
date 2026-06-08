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
  baseline: number;
  observedValue: number;
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
        baseline: first.baseline,
        observedValue: Math.max(...window.map((row) => row.value)),
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
