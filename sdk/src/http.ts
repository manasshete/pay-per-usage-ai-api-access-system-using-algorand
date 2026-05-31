import { SDK_VERSION, SentinelNetworkError, mapHttpError } from "./errors.js";
import type { ApiErrorBody } from "./types.js";

export interface HttpRequestOptions {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  apiKey?: string;
  timeout?: number;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultTimeout: number
  ) {}

  async request<T>(options: HttpRequestOptions): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${options.path}`;
    const controller = new AbortController();
    const timeout = options.timeout ?? this.defaultTimeout;
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `@sentinalapi/sdk@${SDK_VERSION}`,
      "X-Sentinel-SDK-Version": SDK_VERSION,
    };

    if (options.apiKey) {
      headers["X-API-Key"] = options.apiKey;
      headers.Authorization = `Bearer ${options.apiKey}`;
    }

    try {
      const res = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let parsed: ApiErrorBody & Record<string, unknown> = {};
      if (text) {
        try {
          parsed = JSON.parse(text) as ApiErrorBody & Record<string, unknown>;
        } catch {
          parsed = { error: text };
        }
      }

      if (!res.ok) {
        throw mapHttpError(res.status, parsed);
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof Error && err.name.startsWith("Sentinel")) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new SentinelNetworkError(`Request timed out after ${timeout}ms`, { cause: err });
      }
      throw new SentinelNetworkError(
        err instanceof Error ? err.message : "Unknown network error",
        { cause: err }
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
