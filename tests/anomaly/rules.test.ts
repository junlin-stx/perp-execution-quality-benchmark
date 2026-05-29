import { describe, expect, it } from "vitest";
import { detectAnomalies } from "../../src/anomaly/rules.js";

describe("anomaly rules", () => {
  it("detects repeated execution quality degradation", () => {
    const events = detectAnomalies([
      { venue: "grvt", market: "BTC", metric: "avg_slippage_100k_bp", value: 8, baseline: 2, timestampMs: 1 },
      { venue: "grvt", market: "BTC", metric: "avg_slippage_100k_bp", value: 9, baseline: 2, timestampMs: 2 },
      { venue: "grvt", market: "BTC", metric: "avg_slippage_100k_bp", value: 10, baseline: 2, timestampMs: 3 }
    ], { minConsecutive: 3, slippageBpDelta: 5, spreadBpDelta: 3 });
    expect(events).toHaveLength(1);
    expect(events[0].dedupeKey).toBe("grvt:BTC:avg_slippage_100k_bp:1-3");
  });

  it("does not produce non-execution messages", () => {
    const events = detectAnomalies([], { minConsecutive: 3, slippageBpDelta: 5, spreadBpDelta: 3 });
    expect(events).toEqual([]);
  });
});
