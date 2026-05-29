export interface JsonFetchResult {
  data: unknown;
  latencyMs: number;
  localTimestampMs: number;
}

export async function fetchJson(url: string, init?: RequestInit): Promise<JsonFetchResult> {
  const start = Date.now();
  const response = await fetch(url, init);
  const latencyMs = Date.now() - start;
  const localTimestampMs = Date.now();
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`http ${response.status} ${response.statusText}: ${body.slice(0, 200)}`);
  }
  return { data: await response.json(), latencyMs, localTimestampMs };
}
