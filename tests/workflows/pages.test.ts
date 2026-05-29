import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("benchmark pages workflow", () => {
  it("runs every 5 minutes, caches sqlite history, and deploys public artifacts", () => {
    const workflow = readFileSync(".github/workflows/benchmark-pages.yml", "utf8");

    expect(workflow).toContain("- cron: \"*/5 * * * *\"");
    expect(workflow).toContain("actions/cache");
    expect(workflow).toContain("data/benchmark.sqlite");
    expect(workflow).toContain("npm run run:benchmark -- --once");
    expect(workflow).toContain("npm run summary");
    expect(workflow).toContain("npm run telegram:send-anomalies");
    expect(workflow).toContain("TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}");
    expect(workflow).toContain("TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}");
    expect(workflow).toContain("actions/upload-pages-artifact");
    expect(workflow).toContain("actions/deploy-pages");
  });
});
