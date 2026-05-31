import { redisGet, redisIncrBy } from "./redisClient.js";

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function monthUtc() {
  return new Date().toISOString().slice(0, 7);
}

export function weekUtc() {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function readPeriodCounters(prefix, periods) {
  const out = {};
  for (const [label, key] of Object.entries(periods)) {
    const v = await redisGet(key);
    out[label] = v ? parseInt(v, 10) || 0 : 0;
  }
  return out;
}

export function consumerPeriodKeys(consumerId) {
  const id = String(consumerId);
  const day = todayUtc();
  const week = weekUtc();
  const month = monthUtc();
  return {
    calls: {
      today: `consumer:${id}:calls:daily:${day}`,
      week: `consumer:${id}:calls:week:${week}`,
      month: `consumer:${id}:calls:month:${month}`,
    },
    spend: {
      today: `consumer:${id}:spend:daily:${day}`,
      week: `consumer:${id}:spend:week:${week}`,
      month: `consumer:${id}:spend:month:${month}`,
    },
    tokens: {
      today: `consumer:${id}:tokens:daily:${day}`,
      week: `consumer:${id}:tokens:week:${week}`,
      month: `consumer:${id}:tokens:month:${month}`,
    },
  };
}

export function developerPeriodKeys(developerId) {
  const id = String(developerId);
  const day = todayUtc();
  const week = weekUtc();
  const month = monthUtc();
  return {
    calls: {
      today: `developer:${id}:calls:daily:${day}`,
      week: `developer:${id}:calls:week:${week}`,
      month: `developer:${id}:calls:month:${month}`,
    },
    revenue: {
      today: `developer:${id}:revenue:daily:${day}`,
      week: `developer:${id}:revenue:week:${week}`,
      month: `developer:${id}:revenue:month:${month}`,
    },
  };
}

export async function bumpPeriodCounters({ consumerId, developerId, apiId, costCents, earningCents, tokensTotal, success }) {
  const day = todayUtc();
  const week = weekUtc();
  const month = monthUtc();

  await redisIncrBy(`consumer:${consumerId}:calls:daily:${day}`, 1);
  await redisIncrBy(`consumer:${consumerId}:calls:week:${week}`, 1);
  await redisIncrBy(`consumer:${consumerId}:calls:month:${month}`, 1);
  await redisIncrBy(`consumer:${consumerId}:spend:daily:${day}`, costCents);
  await redisIncrBy(`consumer:${consumerId}:spend:week:${week}`, costCents);
  await redisIncrBy(`consumer:${consumerId}:spend:month:${month}`, costCents);
  if (tokensTotal > 0) {
    await redisIncrBy(`consumer:${consumerId}:tokens:daily:${day}`, tokensTotal);
    await redisIncrBy(`consumer:${consumerId}:tokens:week:${week}`, tokensTotal);
    await redisIncrBy(`consumer:${consumerId}:tokens:month:${month}`, tokensTotal);
  }

  await redisIncrBy(`developer:${developerId}:calls:daily:${day}`, 1);
  await redisIncrBy(`developer:${developerId}:calls:week:${week}`, 1);
  await redisIncrBy(`developer:${developerId}:calls:month:${month}`, 1);
  await redisIncrBy(`developer:${developerId}:revenue:daily:${day}`, earningCents);
  await redisIncrBy(`developer:${developerId}:revenue:week:${week}`, earningCents);
  await redisIncrBy(`developer:${developerId}:revenue:month:${month}`, earningCents);

  await redisIncrBy(`api:${apiId}:calls:total`, 1);
  await redisIncrBy(`api:${apiId}:calls:daily:${day}`, 1);
  if (!success) {
    await redisIncrBy(`api:${apiId}:errors:daily:${day}`, 1);
  }
}
