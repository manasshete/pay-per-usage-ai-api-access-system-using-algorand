import { UsageRecord } from "../models/UsageRecord.js";
import { getRedisClient } from "./redisClient.js";
import { refundLockedCents } from "./gatewayBalanceService.js";

const LOCK_PREFIX = "gateway:lock:";
const MAX_AGE_MS = Number(process.env.GATEWAY_LOCK_MAX_AGE_MS || 120000);

export async function recoverStaleGatewayLocks() {
  const redis = getRedisClient();
  if (!redis) return { scanned: 0, refunded: 0 };

  try {
    if (redis.status !== "ready") await redis.connect();
  } catch {
    return { scanned: 0, refunded: 0, error: "redis_unavailable" };
  }

  let cursor = "0";
  let scanned = 0;
  let refunded = 0;

  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${LOCK_PREFIX}*`, "COUNT", 50);
    cursor = next;

    for (const key of keys) {
      scanned++;
      const raw = await redis.get(key);
      if (!raw) continue;

      let lock;
      try {
        lock = JSON.parse(raw);
      } catch {
        continue;
      }

      const age = Date.now() - (lock.ts || 0);
      if (age < MAX_AGE_MS) continue;

      const requestId = key.slice(LOCK_PREFIX.length);
      const usage = await UsageRecord.findOne({ requestId }).lean();
      if (usage) {
        await redis.del(key);
        continue;
      }

      if (lock.userId && lock.cost > 0) {
        await refundLockedCents(lock.userId, lock.cost);
        refunded++;
      }
      await redis.del(key);
    }
  } while (cursor !== "0");

  if (refunded > 0) {
    console.log(`[gatewayRecovery] refunded ${refunded} stale lock(s)`);
  }

  return { scanned, refunded };
}
