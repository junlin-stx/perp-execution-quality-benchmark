import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface R2Config {
  endpoint: string;
  region: "auto";
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
}

export interface DataObjectSpec {
  filePath: string;
  key: string;
  cacheControl: string;
}

export interface R2UploadOptions {
  bucket: string;
  outputDir: string;
  prefix: string;
  keys?: string[];
}

export interface R2CommandClient {
  send(command: { input: unknown }): Promise<unknown>;
}

export function buildR2ConfigFromEnv(env: NodeJS.ProcessEnv): R2Config {
  const accountId = requiredEnv(env, "R2_ACCOUNT_ID");
  return {
    endpoint: env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    accessKeyId: requiredEnv(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv(env, "R2_SECRET_ACCESS_KEY"),
    bucket: requiredEnv(env, "R2_BUCKET"),
    prefix: normalizePrefix(env.R2_PREFIX ?? "")
  };
}

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export function dataObjectSpecs(outputDir = "public", prefix = ""): DataObjectSpec[] {
  const dataDir = join(outputDir, "data");
  mkdirSync(dataDir, { recursive: true });
  return readdirSync(dataDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      filePath: join(dataDir, name),
      key: objectKey(normalizePrefix(prefix), `data/${name}`),
      cacheControl: cacheControlFor(name)
    }));
}

export function latestDataObjectSpecs(outputDir = "public", prefix = ""): DataObjectSpec[] {
  return dataObjectSpecs(outputDir, prefix).filter((spec) => spec.key.endsWith("/latest.json") || spec.key === "data/latest.json");
}

export async function uploadR2DataObjects(client: R2CommandClient, options: R2UploadOptions): Promise<DataObjectSpec[]> {
  const allowedKeys = options.keys ? new Set(options.keys) : null;
  const specs = dataObjectSpecs(options.outputDir, options.prefix).filter((spec) => !allowedKeys || allowedKeys.has(spec.key));
  for (const spec of specs) {
    await client.send(new PutObjectCommand({
      Bucket: options.bucket,
      Key: spec.key,
      Body: readFileSync(spec.filePath),
      ContentType: "application/json; charset=utf-8",
      CacheControl: spec.cacheControl
    }));
  }
  return specs;
}

export async function publishR2Data(outputDir = "public", env = process.env): Promise<DataObjectSpec[]> {
  const config = buildR2ConfigFromEnv(env);
  return uploadR2DataObjects(createR2Client(config), {
    bucket: config.bucket,
    outputDir,
    prefix: config.prefix
  });
}

export async function publishR2Latest(outputDir = "public", env = process.env): Promise<DataObjectSpec[]> {
  const config = buildR2ConfigFromEnv(env);
  const keys = latestDataObjectSpecs(outputDir, config.prefix).map((spec) => spec.key);
  return uploadR2DataObjects(createR2Client(config), {
    bucket: config.bucket,
    outputDir,
    prefix: config.prefix,
    keys
  });
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function objectKey(prefix: string, key: string): string {
  return prefix ? `${prefix}/${key}` : key;
}

function cacheControlFor(name: string): string {
  if (name === "latest.json") return "public, max-age=30, must-revalidate";
  return "public, max-age=300, must-revalidate";
}
