import { User } from "../models/User.js";
import { redisDecrBy, redisGet, redisIncrBy, redisSet, isRedisEnabled } from "./redisClient.js";

const BALANCE_KEY = (userId) => `balance:${userId}`;
const LOCK_KEY = (requestId) => `gateway:lock:${requestId}`;

export async function getBalanceCents(userId) {
  const id = String(userId);
  const cached = await redisGet(BALANCE_KEY(id));
  if (cached !== null && cached !== undefined) {
    return Math.max(0, parseInt(cached, 10) || 0);
  }
  const user = await User.findById(id).select("walletBalanceCents").lean();
  const cents = Math.max(0, Math.round(Number(user?.walletBalanceCents) || 0));
  if (isRedisEnabled()) {
    await redisSet(BALANCE_KEY(id), String(cents), 3600);
  }
  return cents;
}

export async function setBalanceCents(userId, cents) {
  const id = String(userId);
  const value = Math.max(0, Math.round(Number(cents) || 0));
  await User.findByIdAndUpdate(id, { $set: { walletBalanceCents: value } });
  if (isRedisEnabled()) {
    await redisSet(BALANCE_KEY(id), String(value), 3600);
  }
  return value;
}

export async function creditBalanceCents(userId, deltaCents) {
  const id = String(userId);
  const delta = Math.round(Number(deltaCents) || 0);
  if (delta <= 0) return getBalanceCents(id);

  const afterRedis = await redisIncrBy(BALANCE_KEY(id), delta);
  if (afterRedis !== null) {
    await User.findByIdAndUpdate(id, { $inc: { walletBalanceCents: delta } });
    return Math.max(0, afterRedis);
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $inc: { walletBalanceCents: delta } },
    { new: true }
  ).select("walletBalanceCents");
  const cents = Math.max(0, Math.round(Number(user?.walletBalanceCents) || 0));
  await redisSet(BALANCE_KEY(id), String(cents), 3600);
  return cents;
}

/**
 * Atomic optimistic lock: deduct estimated cost before forwarding.
 * Returns { ok, balanceAfter } or { ok: false, balance }.
 */
export async function lockBalanceCents(userId, estimatedCostCents, requestId) {
  const id = String(userId);
  const cost = Math.max(1, Math.round(Number(estimatedCostCents) || 0));

  const after = await redisDecrBy(BALANCE_KEY(id), cost);
  if (after !== null) {
    if (after < 0) {
      await redisIncrBy(BALANCE_KEY(id), cost);
      const restored = Math.max(0, after + cost);
      return { ok: false, balance: restored };
    }
    if (requestId) {
      await redisSet(LOCK_KEY(requestId), JSON.stringify({ userId: id, cost, ts: Date.now() }), 300);
    }
    return { ok: true, balanceAfter: after };
  }

  const current = await getBalanceCents(id);
  if (current < cost) {
    return { ok: false, balance: current };
  }
  const next = current - cost;
  await setBalanceCents(id, next);
  return { ok: true, balanceAfter: next };
}

export async function finalizeBalanceCents(userId, estimatedCostCents, actualCostCents) {
  const id = String(userId);
  const estimate = Math.round(Number(estimatedCostCents) || 0);
  const actual = Math.round(Number(actualCostCents) || 0);
  const delta = estimate - actual;

  if (delta === 0) return getBalanceCents(id);

  if (delta > 0) {
    await redisIncrBy(BALANCE_KEY(id), delta);
    await User.findByIdAndUpdate(id, { $inc: { walletBalanceCents: delta } });
  } else {
    const extra = -delta;
    const after = await redisDecrBy(BALANCE_KEY(id), extra);
    if (after !== null && after < 0) {
      await redisIncrBy(BALANCE_KEY(id), extra);
    }
    await User.findByIdAndUpdate(id, { $inc: { walletBalanceCents: -extra } });
  }
  return getBalanceCents(id);
}

export async function refundLockedCents(userId, amountCents) {
  return creditBalanceCents(userId, Math.round(Number(amountCents) || 0));
}
