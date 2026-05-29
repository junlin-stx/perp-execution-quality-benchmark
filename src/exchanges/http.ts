export interface JsonFetchResult {
  data: unknown;
  latencyMs: number;
  localTimestampMs: number;
}

export interface JsonFetchOptions {
  retries?: number;
  retryDelayMs?: number;
}

export async function fetchJson(url: string, init?: RequestInit, options: JsonFetchOptions = {}): Promise<JsonFetchResult> {
  const start = Date.now();
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const latencyMs = Date.now() - start;
      const localTimestampMs = Date.now();
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`http ${response.status} ${response.statusText}: ${body.slice(0, 200)}`);
      }
      return { data: await response.json(), latencyMs, localTimestampMs };
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
