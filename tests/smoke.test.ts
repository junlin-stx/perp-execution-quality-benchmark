import { describe, expect, it } from "vitest";
import { benchmarkVersion } from "../src/version.js";

describe("project skeleton", () => {
  it("has a benchmark version", () => {
    expect(benchmarkVersion).toBe("0.1.0");
  });
});
