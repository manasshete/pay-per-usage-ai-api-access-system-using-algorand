import { AlertConfig } from "../models/AlertConfig.js";
import { User } from "../models/User.js";
import { readPeriodCounters, consumerPeriodKeys } from "./gatewayPeriodStats.js";

const COOLDOWN_MS = 3600000;

async function shouldFire(config) {
  if (!config.isActive) return false;
  if (!config.lastTriggeredAt) return true;
  return Date.now() - new Date(config.lastTriggeredAt).getTime() >= COOLDOWN_MS;
}

async function markTriggered(configId) {
  await AlertConfig.updateOne({ _id: configId }, { $set: { lastTriggeredAt: new Date() } });
}

async function notify(config, message) {
  if (config.notifyEmail) {
    const user = await User.findById(config.userId).select("email walletAddress").lean();
    console.warn(`[gatewayAlert] ${config.type} user=${config.userId} email=${user?.email || "n/a"} — ${message}`);
  }
}

export async function runGatewayEventAlerts({
  userId,
  developerId,
  apiId,
  balanceCents,
  costCents,
  requestStatus,
  httpStatus,
  success,
}) {
  const configs = await AlertConfig.find({ userId, isActive: true }).lean();
  const keys = consumerPeriodKeys(userId);
  const [spend, calls] = await Promise.all([
    readPeriodCounters("spend", keys.spend),
    readPeriodCounters("calls", keys.calls),
  ]);

  for (const cfg of configs) {
    if (!(await shouldFire(cfg))) continue;

    if (cfg.type === "low_balance" && balanceCents <= cfg.thresholdCents) {
      await markTriggered(cfg._id);
      await notify(cfg, `Balance ${balanceCents} cents`);
    }
    if (cfg.type === "high_spending" && spend.month >= cfg.thresholdCents) {
      await markTriggered(cfg._id);
      await notify(cfg, `Monthly spend ${spend.month} cents`);
    }
    if (cfg.type === "high_usage" && calls.today >= cfg.thresholdCents) {
      await markTriggered(cfg._id);
      await notify(cfg, `Daily call count ${calls.today} >= ${cfg.thresholdCents}`);
    }
    if (cfg.type === "monthly_budget" && spend.month >= cfg.thresholdCents) {
      await markTriggered(cfg._id);
      await notify(cfg, `Monthly budget exceeded`);
    }
  }

  if (developerId && apiId && !success) {
    const devConfigs = await AlertConfig.find({
      userId: developerId,
      type: { $in: ["api_outage", "rate_limit"] },
      isActive: true,
    }).lean();
    for (const cfg of devConfigs) {
      if (!(await shouldFire(cfg))) continue;
      if (cfg.type === "api_outage" && (httpStatus >= 500 || requestStatus === "failed")) {
        await markTriggered(cfg._id);
        await notify(cfg, `API ${apiId} error HTTP ${httpStatus}`);
      }
    }
  }
}
