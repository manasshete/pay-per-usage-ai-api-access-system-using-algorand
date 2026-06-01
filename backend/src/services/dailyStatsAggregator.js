import { UsageRecord } from "../models/UsageRecord.js";
import { DailyStats } from "../models/DailyStats.js";

function yesterdayRange() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);
  return { start, end, date: start };
}

async function upsertStat(entityType, entityId, date, fields) {
  await DailyStats.findOneAndUpdate(
    { entityType, entityId, date },
    { $set: { ...fields, entityType, entityId, date } },
    { upsert: true }
  );
}

export async function aggregateYesterdayStats() {
  const { start, end, date } = yesterdayRange();

  const rows = await UsageRecord.aggregate([
    { $match: { timestamp: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: {
          consumerId: "$consumerId",
          developerId: "$developerId",
          apiId: "$apiId",
        },
        totalCalls: { $sum: 1 },
        successCalls: {
          $sum: { $cond: [{ $eq: ["$requestStatus", "success"] }, 1, 0] },
        },
        failedCalls: {
          $sum: { $cond: [{ $ne: ["$requestStatus", "success"] }, 1, 0] },
        },
        totalTokens: { $sum: { $ifNull: ["$tokensTotal", 0] } },
        totalCostCents: { $sum: "$costCents" },
        avgResponseTimeMs: { $avg: "$responseTimeMs" },
        latencies: { $push: "$responseTimeMs" },
      },
    },
  ]);

  const consumerMap = new Map();
  const developerMap = new Map();
  const apiMap = new Map();

  for (const row of rows) {
    const { consumerId, developerId, apiId } = row._id;
    const p95 = percentile(row.latencies.filter((n) => Number.isFinite(n)), 0.95);

    if (consumerId) {
      const k = String(consumerId);
      const c = consumerMap.get(k) || emptyAgg();
      mergeAgg(c, row);
      consumerMap.set(k, c);
    }
    if (developerId) {
      const k = String(developerId);
      const d = developerMap.get(k) || emptyAgg();
      mergeAgg(d, row);
      d.totalRevenueCents += row.totalCostCents;
      developerMap.set(k, d);
    }
    if (apiId) {
      const k = String(apiId);
      const a = apiMap.get(k) || emptyAgg();
      mergeAgg(a, row);
      apiMap.set(k, a);
    }
  }

  let upserted = 0;
  for (const [id, agg] of consumerMap) {
    await upsertStat("consumer", id, date, agg);
    upserted++;
  }
  for (const [id, agg] of developerMap) {
    await upsertStat("developer", id, date, agg);
    upserted++;
  }
  for (const [id, agg] of apiMap) {
    await upsertStat("api", id, date, agg);
    upserted++;
  }

  return { date, upserted, usageRows: rows.length };
}

function emptyAgg() {
  return {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    totalTokens: 0,
    totalCostCents: 0,
    totalRevenueCents: 0,
    avgResponseTimeMs: 0,
    p95ResponseTimeMs: 0,
    uniqueApis: 0,
  };
}

function mergeAgg(target, row) {
  target.totalCalls += row.totalCalls;
  target.successCalls += row.successCalls;
  target.failedCalls += row.failedCalls;
  target.totalTokens += row.totalTokens;
  target.totalCostCents += row.totalCostCents;
  target.avgResponseTimeMs = row.avgResponseTimeMs ?? target.avgResponseTimeMs;
  target.p95ResponseTimeMs = percentile(row.latencies.filter((n) => Number.isFinite(n)), 0.95);
  target.uniqueApis += 1;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}
