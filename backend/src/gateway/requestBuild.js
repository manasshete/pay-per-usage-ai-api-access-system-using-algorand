export const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "authorization",
  "x-sentinel-key",
  "x-sentinel-project",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
]);

export const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

export function buildForwardPathAndQuery(req) {
  const raw = String(req.gatewayForwardPath || req.url || "");
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) {
    return { path: raw || "/chat/completions", search: "" };
  }
  return {
    path: raw.slice(0, qIndex) || "/chat/completions",
    search: raw.slice(qIndex),
  };
}

export function mergeClientHeaders(req, baseHeaders) {
  const headers = { ...baseHeaders };
  for (const [k, v] of Object.entries(req.headers)) {
    const lower = k.toLowerCase();
    if (STRIP_HEADERS.has(lower) || lower.startsWith("x-sentinel-")) continue;
    if (v === undefined || v === "") continue;
    headers[k] = v;
  }
  if (req.ip) headers["X-Forwarded-For"] = String(req.ip);
  return headers;
}

export function resolveRequestBody(req, method) {
  const m = method.toUpperCase();
  if (!METHODS_WITH_BODY.has(m)) return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  if (Object.keys(req.body).length === 0 && !req.headers["content-type"]) return undefined;
  return req.body;
}

export function isStreamingResponse(contentType) {
  const ct = String(contentType || "").toLowerCase();
  return ct.includes("text/event-stream") || ct.includes("application/x-ndjson");
}
