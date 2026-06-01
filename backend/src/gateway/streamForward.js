import axios from "axios";
import { createParser } from "eventsource-parser";
import { decryptSecret } from "../utils/encrypt.js";
import { buildProviderUrl, providerHeaders } from "./providerForward.js";

// re-export for tests
export { buildProviderUrl };

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "authorization",
  "x-sentinel-key",
  "x-sentinel-project",
]);

function wantsStream(req) {
  if (req.body?.stream === true) return true;
  const accept = String(req.headers.accept || "");
  return accept.includes("text/event-stream");
}

export { wantsStream };

function parseSseUsage(chunkText) {
  let total = 0;
  let prompt = 0;
  let completion = 0;
  for (const line of chunkText.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      const u = json?.usage;
      if (u?.total_tokens) {
        total = u.total_tokens;
        prompt = u.prompt_tokens ?? prompt;
        completion = u.completion_tokens ?? completion;
      }
    } catch {
      /* ignore partial JSON */
    }
  }
  if (total > 0) {
    return { prompt, completion, total, source: "provider", fallbackToRequest: false };
  }
  return null;
}

export async function forwardStreamToClient({
  api,
  method,
  forwardPath,
  req,
  res,
  timeoutMs,
  onComplete,
}) {
  let providerKey = null;
  if (api.authHeaderEncrypted) {
    providerKey = decryptSecret(api.authHeaderEncrypted);
  }

  const url = buildProviderUrl(api, forwardPath);
  const headers = providerHeaders(api, providerKey);
  for (const [k, v] of Object.entries(req.headers)) {
    const lower = k.toLowerCase();
    if (STRIP_HEADERS.has(lower) || lower.startsWith("x-sentinel-")) continue;
    if (v !== undefined) headers[k] = v;
  }
  if (req.ip) headers["X-Forwarded-For"] = req.ip;

  const body = { ...req.body, stream: true };
  const started = Date.now();
  let tokenAccumulator = { prompt: null, completion: null, total: null, source: "none", fallbackToRequest: true };
  let httpStatus = 200;
  let providerError = null;

  try {
    const resp = await axios({
      method,
      url,
      headers,
      data: body,
      responseType: "stream",
      timeout: timeoutMs || api.timeoutMs || 120000,
      validateStatus: () => true,
    });

    httpStatus = resp.status;
    providerKey = null;

    if (httpStatus >= 500) {
      providerError = `Provider HTTP ${httpStatus}`;
      return { ok: false, httpStatus, providerError, responseTimeMs: Date.now() - started };
    }

    const contentType = resp.headers["content-type"] || "text/event-stream";
    res.setHeader("Content-Type", contentType);
    if (resp.headers["transfer-encoding"]) {
      res.setHeader("Transfer-Encoding", resp.headers["transfer-encoding"]);
    }
    res.flushHeaders?.();

    const parser = createParser({
      onEvent(event) {
        const usage = parseSseUsage(`data: ${event.data}`);
        if (usage) tokenAccumulator = usage;
      },
    });

    await new Promise((resolve, reject) => {
      resp.data.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        try {
          parser.feed(text);
        } catch {
          /* ignore */
        }
        res.write(chunk);
      });
      resp.data.on("end", () => resolve());
      resp.data.on("error", reject);
      res.on("close", () => {
        try {
          resp.data.destroy();
        } catch {
          /* ignore */
        }
      });
    });

    res.end();
    const result = {
      ok: true,
      httpStatus,
      tokens: tokenAccumulator,
      responseTimeMs: Date.now() - started,
    };
    await onComplete?.(result);
    return result;
  } catch (err) {
    providerKey = null;
    if (!res.headersSent) {
      return {
        ok: false,
        timeout: err.code === "ECONNABORTED",
        providerError: err.message,
        responseTimeMs: Date.now() - started,
      };
    }
    try {
      res.end();
    } catch {
      /* ignore */
    }
    const result = {
      ok: false,
      providerError: err.message,
      responseTimeMs: Date.now() - started,
      tokens: tokenAccumulator,
    };
    await onComplete?.(result);
    return result;
  }
}
