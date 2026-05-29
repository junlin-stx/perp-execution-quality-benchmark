import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildR2ConfigFromEnv, dataObjectSpecs, latestDataObjectSpecs, uploadR2DataObjects } from "../../src/publish/r2.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("R2 publisher", () => {
  it("builds S3-compatible R2 config from environment variables", () => {
    const config = buildR2ConfigFromEnv({
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "bucket",
      R2_PREFIX: "bench"
    });

    expect(config).toMatchObject({
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "bucket",
      prefix: "bench"
    });
  });

  it("maps public data json files to stable R2 object keys and cache headers", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-r2-"));
    const dataDir = join(tempDir, "public", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "latest.json"), "{}", { flag: "w" });
    writeFileSync(join(dataDir, "history-7d.json"), "[]", { flag: "w" });

    const specs = dataObjectSpecs(join(tempDir, "public"), "perp");

    expect(specs.map((spec) => spec.key)).toEqual(["perp/data/history-7d.json", "perp/data/latest.json"]);
    expect(specs.find((spec) => spec.key.endsWith("latest.json"))?.cacheControl).toBe("public, max-age=30, must-revalidate");
    expect(specs.find((spec) => spec.key.endsWith("history-7d.json"))?.cacheControl).toBe("public, max-age=300, must-revalidate");
  });

  it("can select only latest json for realtime uploads", () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-r2-"));
    const dataDir = join(tempDir, "public", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "latest.json"), "{}", { flag: "w" });
    writeFileSync(join(dataDir, "history-7d.json"), "[]", { flag: "w" });

    expect(latestDataObjectSpecs(join(tempDir, "public"), "perp").map((spec) => spec.key)).toEqual(["perp/data/latest.json"]);
  });

  it("uploads json objects with content type and cache control", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "perp-r2-"));
    const dataDir = join(tempDir, "public", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "latest.json"), "{\"ok\":true}\n", { flag: "w" });
    const sent: unknown[] = [];
    const client = { send: async (command: { input: unknown }) => sent.push(command.input) };

    await uploadR2DataObjects(client, {
      bucket: "bucket",
      outputDir: join(tempDir, "public"),
      prefix: ""
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      Bucket: "bucket",
      Key: "data/latest.json",
      ContentType: "application/json; charset=utf-8",
      CacheControl: "public, max-age=30, must-revalidate"
    });
    expect((sent[0] as { Body: Buffer }).Body.toString("utf8")).toBe(readFileSync(join(dataDir, "latest.json"), "utf8"));
  });
});
