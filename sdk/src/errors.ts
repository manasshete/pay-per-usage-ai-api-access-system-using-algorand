import type { ApiErrorBody } from "./types.js";

export const SDK_VERSION = "1.0.0";

export class SentinelError extends Error {
  readonly status?: number;
  readonly body?: ApiErrorBody;

  constructor(message: string, options?: { status?: number; body?: ApiErrorBody; cause?: unknown }) {
    super(message);
    this.name = "SentinelError";
    this.status = options?.status;
    this.body = options?.body;
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export class SentinelAuthError extends SentinelError {
  constructor(message = "Invalid or missing API key", options?: { status?: number; body?: ApiErrorBody }) {
    super(message, { status: options?.status ?? 401, body: options?.body });
    this.name = "SentinelAuthError";
  }
}

export class SentinelPaymentError extends SentinelError {
  constructor(message = "Payment could not be verified", options?: { status?: number; body?: ApiErrorBody }) {
    super(message, { status: options?.status ?? 402, body: options?.body });
    this.name = "SentinelPaymentError";
  }
}

export class SentinelSessionExpired extends SentinelError {
  constructor(
    message = "Payment session expired or unknown. Request a new quote within 60 seconds.",
    options?: { status?: number; body?: ApiErrorBody }
  ) {
    super(message, { status: options?.status ?? 410, body: options?.body });
    this.name = "SentinelSessionExpired";
  }
}

export class SentinelUpstreamError extends SentinelError {
  constructor(message = "Upstream AI provider failed", options?: { status?: number; body?: ApiErrorBody }) {
    super(message, { status: options?.status ?? 502, body: options?.body });
    this.name = "SentinelUpstreamError";
  }
}

export class SentinelNetworkError extends SentinelError {
  constructor(message = "Network request failed", options?: { cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "SentinelNetworkError";
  }
}

export function mapHttpError(status: number, body: ApiErrorBody): SentinelError {
  const msg = body.error || body.detail || `HTTP ${status}`;
  if (status === 401 || status === 403) return new SentinelAuthError(msg, { status, body });
  if (status === 402) return new SentinelPaymentError(msg, { status, body });
  if (status === 410) return new SentinelSessionExpired(msg, { status, body });
  if (status === 502 || status === 503) return new SentinelUpstreamError(msg, { status, body });
  return new SentinelError(msg, { status, body });
}
