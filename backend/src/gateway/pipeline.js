import crypto from "crypto";
import { gatewayError } from "./errors.js";
import {
  estimateCostCents,
  calculateActualCostCents,
  extractTokensFromProviderBody,
} from "./costCalculator.js";
import { getApiBySlug, resolveConsumerFromApiKey, hasActiveSubscription } from "./cache.js";
import {
  forwardToProvider,
  pipeProviderStreamToClient,
  sendProviderResponse,
} from "./providerForward.js";
import { buildForwardPathAndQuery } from "./requestBuild.js";
import { wantsStream } from "./streamDetect.js";
import { completeGatewayBilling } from "./billingHandlers.js";
import { resolveProjectId } from "./projectResolve.js";
import {
  getBalanceCents,
  lockBalanceCents,
  refundLockedCents,
} from "../services/gatewayBalanceService.js";
import { persistUsageRecord } from "../services/gatewayPersistence.js";
import { redisIncrBy, redisSet } from "../services/redisClient.js";
import { ProxyApi } from "../models/ProxyApi.js";

const RATE_LIMIT_PER_MIN = Number(process.env.GATEWAY_RATE_LIMIT_PER_MIN || 60);
const STREAM_COST_MULTIPLIER = Number(process.env.GATEWAY_STREAM_COST_MULTIPLIER || 2);

function extractApiKey(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-sentinel-key"] || "").trim();
}

async function checkRateLimit(consumerId, apiId) {
  const bucket = `ratelimit:${consumerId}:${apiId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redisIncrBy(bucket, 1);
  if (count === 1) await redisSet(bucket, String(count), 120);
  return count !== null && count > RATE_LIMIT_PER_MIN;
}

function isBillableStatus(httpStatus) {
  return httpStatus >= 200 && httpStatus < 400;
}

async function runPreflight(req, res) {
  const requestId = crypto.randomUUID();
  const slug = String(req.gatewaySlug || "").toLowerCase();
  const { path: forwardPath, search } = buildForwardPathAndQuery(req);
  const method = req.method.toUpperCase();
  const isStream = wantsStream(req);

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    gatewayError(res, 401, "INVALID_KEY", "Missing API key (Authorization Bearer or X-Sentinel-Key).", {
      requestId,
    });
    return null;
  }

  const api = await getApiBySlug(slug);
  if (!api) {
    gatewayError(res, 404, "API_NOT_FOUND", "Proxy slug does not exist or API is inactive.", {
      requestId,
    });
    return null;
  }

  const auth = await resolveConsumerFromApiKey(apiKey);
  if (!auth) {
    gatewayError(res, 401, "INVALID_KEY", "API key not found or expired.", { requestId });
    return null;
  }

  const subscription = await hasActiveSubscription(auth.consumerId, api._id, auth.subscription);
  if (!subscription) {
    gatewayError(res, 403, "NOT_SUBSCRIBED", "You are not subscribed to this API.", { requestId });
    return null;
  }

  if (await checkRateLimit(auth.consumerId, String(api._id))) {
    res.setHeader("Retry-After", "60");
    gatewayError(res, 429, "RATE_LIMIT_EXCEEDED", "Too many requests in the current window.", {
      requestId,
    });
    return null;
  }

  let estimatedCostCents = estimateCostCents(api);
  if (isStream) {
    estimatedCostCents = Math.max(estimatedCostCents, Math.round(estimatedCostCents * STREAM_COST_MULTIPLIER));
  }

  const balanceBefore = await getBalanceCents(auth.consumerId);
  if (balanceBefore < estimatedCostCents) {
    gatewayError(res, 402, "INSUFFICIENT_BALANCE", "Your Sentinel balance is too low.", {
      requestId,
      balance: balanceBefore,
      estimatedCost: estimatedCostCents,
    });
    return null;
  }

  const lock = await lockBalanceCents(auth.consumerId, estimatedCostCents, requestId);
  if (!lock.ok) {
    gatewayError(res, 402, "INSUFFICIENT_BALANCE", "Your Sentinel balance is too low.", {
      requestId,
      balance: lock.balance,
      estimatedCost: estimatedCostCents,
    });
    return null;
  }

  const projectId = await resolveProjectId(auth.consumerId, req.headers["x-sentinel-project"]);

  return {
    requestId,
    api,
    auth,
    subscription,
    forwardPath,
    search,
    method,
    isStream,
    estimatedCostCents,
    consumerId: auth.consumerId,
    apiKeyPrefix: auth.apiKeyPrefix,
    projectId,
  };
}

async function finalizeUsage(ctx, billing) {
  return completeGatewayBilling({
    consumerId: ctx.consumerId,
    api: ctx.api,
    subscription: ctx.subscription,
    requestId: ctx.requestId,
    method: ctx.method,
    forwardPath: ctx.forwardPath,
    apiKeyPrefix: ctx.apiKeyPrefix,
    projectId: ctx.projectId,
    ...billing,
  });
}

export async function runGatewayPipeline(req, res) {
  const ctx = await runPreflight(req, res);
  if (!ctx) return;

  res.setHeader("X-Sentinel-Request-Id", ctx.requestId);
  const started = Date.now();

  if (ctx.isStream && ctx.api.streamingSupported !== false) {
    const streamResult = await pipeProviderStreamToClient({
      api: ctx.api,
      method: ctx.method,
      forwardPath: ctx.forwardPath,
      search: ctx.search,
      req,
      res,
      timeoutMs: ctx.api.timeoutMs,
    });

    if (streamResult.timeout) {
      await refundLockedCents(ctx.consumerId, ctx.estimatedCostCents);
      if (!res.headersSent) {
        return gatewayError(res, 504, "PROVIDER_TIMEOUT", "Provider API did not respond in time.", {
          requestId: ctx.requestId,
        });
      }
      return;
    }

    const httpStatus = streamResult.httpStatus || 200;
    const billable = streamResult.ok && isBillableStatus(httpStatus);
    const tokens = streamResult.tokens || { fallbackToRequest: true };
    let actualCostCents = 0;
    if (billable) {
      actualCostCents = calculateActualCostCents(ctx.api, { tokens, requestCount: 1 });
      if (tokens.fallbackToRequest && ctx.api.pricingModel !== "per_request") {
        actualCostCents = estimateCostCents(ctx.api);
      }
    }

    await finalizeUsage(ctx, {
      estimatedCostCents: ctx.estimatedCostCents,
      actualCostCents,
      billingStatus: billable ? "charged" : "failed",
      requestStatus: billable ? "success" : "failed",
      httpStatus,
      responseTimeMs: streamResult.responseTimeMs ?? Date.now() - started,
      tokens,
      errorMessage: billable ? null : streamResult.providerError,
    });
    return;
  }

  const forward = await forwardToProvider({
    api: ctx.api,
    method: ctx.method,
    forwardPath: ctx.forwardPath,
    search: ctx.search,
    req,
    timeoutMs: ctx.api.timeoutMs,
    res,
  });

  if (forward.streamed) {
    const httpStatus = forward.httpStatus || 200;
    const billable = forward.ok && isBillableStatus(httpStatus);
    const tokens = forward.tokens || { fallbackToRequest: true };
    let actualCostCents = 0;
    if (billable) {
      actualCostCents = calculateActualCostCents(ctx.api, { tokens, requestCount: 1 });
      if (tokens.fallbackToRequest && ctx.api.pricingModel !== "per_request") {
        actualCostCents = estimateCostCents(ctx.api);
      }
    }
    await finalizeUsage(ctx, {
      estimatedCostCents: ctx.estimatedCostCents,
      actualCostCents,
      billingStatus: billable ? "charged" : "failed",
      requestStatus: billable ? "success" : "failed",
      httpStatus,
      responseTimeMs: forward.responseTimeMs ?? Date.now() - started,
      tokens,
      errorMessage: billable ? null : forward.providerError,
    });
    if (billable) void ProxyApi.updateOne({ _id: ctx.api._id }, { $inc: { callCount: 1 } });
    return;
  }

  if (forward.timeout) {
    await refundLockedCents(ctx.consumerId, ctx.estimatedCostCents);
    await persistUsageRecord({
      requestId: ctx.requestId,
      consumerId: ctx.consumerId,
      developerId: ctx.api.developerId,
      apiId: ctx.api._id,
      subscriptionId: ctx.subscription._id,
      apiKeyPrefix: ctx.apiKeyPrefix,
      projectId: ctx.projectId,
      method: ctx.method,
      endpoint: ctx.forwardPath,
      requestStatus: "failed",
      httpStatus: 504,
      responseTimeMs: forward.responseTimeMs,
      costCents: 0,
      billingStatus: "failed",
      errorMessage: "Provider timeout",
    });
    return gatewayError(res, 504, "PROVIDER_TIMEOUT", "Provider API did not respond in time.", {
      requestId: ctx.requestId,
    });
  }

  const httpStatus = forward.status || 502;
  const billable = forward.ok && isBillableStatus(httpStatus);
  const tokens = extractTokensFromProviderBody(forward.data, ctx.api.aiProvider);

  let actualCostCents = 0;
  if (billable) {
    actualCostCents = calculateActualCostCents(ctx.api, { tokens, requestCount: 1 });
    if (tokens.fallbackToRequest && ctx.api.pricingModel !== "per_request") {
      actualCostCents = estimateCostCents(ctx.api);
    }
  }

  const { balanceAfter, actualCostCents: charged } = await finalizeUsage(ctx, {
    estimatedCostCents: ctx.estimatedCostCents,
    actualCostCents,
    billingStatus: billable ? "charged" : "failed",
    requestStatus: billable ? "success" : "failed",
    httpStatus,
    responseTimeMs: forward.responseTimeMs ?? Date.now() - started,
    tokens,
    errorMessage: billable ? null : forward.error || `HTTP ${httpStatus}`,
  });

  if (!billable) {
    if (httpStatus >= 500) {
      return gatewayError(res, 502, "PROVIDER_ERROR", forward.error || "Provider error", {
        requestId: ctx.requestId,
        fields: { httpStatus },
      });
    }
    return sendProviderResponse(res, forward, {
      requestId: ctx.requestId,
      actualCostCents: 0,
      balanceAfter,
    });
  }

  void ProxyApi.updateOne({ _id: ctx.api._id }, { $inc: { callCount: 1 } });

  return sendProviderResponse(res, forward, {
    requestId: ctx.requestId,
    actualCostCents: charged,
    balanceAfter,
  });
}
