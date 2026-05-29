import { describe, expect, it } from "vitest";
import { shouldExportAfterRound, shouldRunScheduledTask } from "../../src/runner/schedule.js";

describe("runner schedule", () => {
  it("exports on the first round", () => {
    expect(shouldExportAfterRound({ lastExportMs: null, nowMs: 1_000, exportIntervalSeconds: 300 })).toBe(true);
  });

  it("exports after the configured interval", () => {
    expect(shouldExportAfterRound({ lastExportMs: 1_000, nowMs: 301_000, exportIntervalSeconds: 300 })).toBe(true);
    expect(shouldExportAfterRound({ lastExportMs: 1_000, nowMs: 300_999, exportIntervalSeconds: 300 })).toBe(false);
  });

  it("supports independent latest and history export schedules", () => {
    expect(shouldRunScheduledTask({ lastRunMs: 1_000, nowMs: 61_000, intervalSeconds: 60 })).toBe(true);
    expect(shouldRunScheduledTask({ lastRunMs: 1_000, nowMs: 61_000, intervalSeconds: 300 })).toBe(false);
  });
});
