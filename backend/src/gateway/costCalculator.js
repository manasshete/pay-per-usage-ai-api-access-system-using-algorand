import { extractTokenUsage } from "../services/billing.js";

const PLATFORM_FEE_BPS = Number(process.env.GATEWAY_PLATFORM_FEE_BPS || 2000);

export function platformFeeFromGross(grossCents) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const fee = Math.floor((gross * PLATFORM_FEE_BPS) / 10000);
  return { platformFeeCents: fee, earningCents: gross - fee };
}

export function estimateCostCents(api) {
  const unit = Math.max(0, Math.round(Number(api.pricePerUnit) || 0));
  const model = api.pricingModel || "per_request";
  if (model === "per_1000_requests") {
    return Math.max(1, Math.ceil(unit / 1000));
  }
  return Math.max(1, unit);
}

export function calculateActualCostCents(api, { tokens, requestCount = 1 }) {
  const unit = Math.max(0, Math.round(Number(api.pricePerUnit) || 0));
  const model = api.pricingModel || "per_request";

  if (model === "per_token" && tokens?.total > 0) {
    return Math.max(1, Math.round(tokens.total * unit));
  }
  if (model === "per_1000_tokens" && tokens?.total > 0) {
    return Math.max(1, Math.round((tokens.total / 1000) * unit));
  }
  if (model === "per_1000_requests") {
    return Math.max(1, Math.ceil((requestCount / 1000) * unit));
  }
  return Math.max(1, unit * requestCount);
}

export function extractTokensFromProviderBody(body, provider) {
  if (!body || typeof body !== "object") {
    return { prompt: null, completion: null, total: null, source: "none", fallbackToRequest: true };
  }
  const usage = extractTokenUsage(provider, body);
  if (usage) {
    return {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens,
      source: "provider",
      fallbackToRequest: false,
    };
  }
  return { prompt: null, completion: null, total: null, source: "none", fallbackToRequest: true };
}
