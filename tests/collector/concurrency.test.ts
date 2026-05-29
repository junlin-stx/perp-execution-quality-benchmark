import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../../src/collector/concurrency.js";

describe("collector concurrency", () => {
  it("limits in-flight work while preserving result order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return value * 10;
    });

    expect(maxInFlight).toBe(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });
});
