import { ProxyApi } from "../models/ProxyApi.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import { User } from "../models/User.js";
import { AccessToken } from "../models/AccessToken.js";
import { redisGet, redisSet } from "../services/redisClient.js";

const API_CACHE_TTL = 300;
const KEY_CACHE_TTL = 600;

export async function getApiBySlug(slug) {
  const key = `gateway:api:slug:${slug}`;
  const cached = await redisGet(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      /* fall through */
    }
  }
  const doc = await ProxyApi.findOne({ proxySlug: slug.toLowerCase(), isActive: true }).lean();
  if (doc) {
    await redisSet(key, JSON.stringify(doc), API_CACHE_TTL);
  }
  return doc;
}

export async function resolveConsumerFromApiKey(apiKey) {
  const raw = String(apiKey || "").trim();
  if (!raw) return null;

  const cacheKey = `gateway:key:${raw.slice(0, 12)}`;
  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      /* fall through */
    }
  }

  let consumer = await User.findOne({ sentinelApiKey: raw }).lean();
  let subscription = null;

  if (!consumer) {
    subscription = await GatewaySubscription.findOne({
      developerIssuedKey: raw,
      isActive: true,
    }).lean();
    if (subscription) {
      consumer = await User.findById(subscription.consumerId).lean();
    }
  }

  if (!consumer) {
    const legacy = await AccessToken.findOne({ key: raw }).lean();
    if (legacy) {
      consumer = await User.findOne({ walletAddress: legacy.userWallet }).lean();
      if (consumer) {
        subscription = await GatewaySubscription.findOne({
          consumerId: consumer._id,
          legacyAccessTokenId: legacy._id,
          isActive: true,
        }).lean();
      }
    }
  }

  if (!consumer) return null;

  const payload = {
    consumerId: String(consumer._id),
    consumer,
    subscription,
    apiKeyPrefix: raw.slice(0, 12),
    apiKeyType: subscription ? "subscription" : consumer.sentinelApiKey === raw ? "master" : "legacy",
  };
  await redisSet(cacheKey, JSON.stringify(payload), KEY_CACHE_TTL);
  return payload;
}

export async function hasActiveSubscription(consumerId, apiId, subscriptionFromKey) {
  if (subscriptionFromKey && String(subscriptionFromKey.apiId) === String(apiId)) {
    return subscriptionFromKey;
  }
  return GatewaySubscription.findOne({
    consumerId,
    apiId,
    isActive: true,
  }).lean();
}
