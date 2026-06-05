import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("pm2 benchmark process entry", () => {
  it("defines the realtime R2 publisher process", () => {
    const ecosystem = require("../../ecosystem.config.cjs");

    expect(ecosystem.apps).toHaveLength(1);
    expect(ecosystem.apps[0]).toMatchObject({
      name: "perp-bench",
      script: "npm",
      args: [
        "run",
        "run:benchmark",
        "--",
        "--collect-interval",
        "60",
        "--latest-export-interval",
        "60",
        "--history-export-interval",
        "300",
        "--concurrency",
        "4",
        "--publish-r2"
      ],
      env: {
        NODE_ENV: "production"
      }
    });
  });

  it("exposes npm scripts for pm2 lifecycle management", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts).toMatchObject({
      "pm2:start": "pm2 start ecosystem.config.cjs --env production",
      "pm2:restart": "pm2 restart ecosystem.config.cjs --env production",
      "pm2:stop": "pm2 stop perp-bench",
      "pm2:delete": "pm2 delete perp-bench",
      "pm2:status": "pm2 status perp-bench",
      "pm2:logs": "pm2 logs perp-bench",
      "pm2:save": "pm2 save"
    });
  });
});
