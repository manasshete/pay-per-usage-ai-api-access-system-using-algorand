import { AlertConfig } from "../models/AlertConfig.js";
import { User } from "../models/User.js";

export async function checkLowBalanceAlerts(userId, balanceCents) {
  const configs = await AlertConfig.find({
    userId,
    type: "low_balance",
    isActive: true,
  }).lean();

  const triggered = [];
  for (const cfg of configs) {
    if (balanceCents <= cfg.thresholdCents) {
      const cooldownMs = 3600000;
      if (cfg.lastTriggeredAt && Date.now() - new Date(cfg.lastTriggeredAt).getTime() < cooldownMs) {
        continue;
      }
      await AlertConfig.updateOne({ _id: cfg._id }, { $set: { lastTriggeredAt: new Date() } });
      triggered.push({ type: "low_balance", thresholdCents: cfg.thresholdCents, balanceCents });
      if (cfg.notifyEmail) {
        const user = await User.findById(userId).select("email").lean();
        console.warn(
          `[gatewayAlert] low_balance user=${userId} email=${user?.email || "n/a"} balance=${balanceCents}`
        );
      }
    }
  }
  return triggered;
}

export async function listAlertConfigs(userId) {
  return AlertConfig.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function upsertAlertConfig(userId, { type, thresholdCents, notifyEmail, isActive }) {
  const doc = await AlertConfig.findOneAndUpdate(
    { userId, type },
    {
      $set: {
        thresholdCents: Math.round(Number(thresholdCents) || 0),
        notifyEmail: Boolean(notifyEmail),
        isActive: isActive !== false,
      },
    },
    { upsert: true, new: true }
  );
  return doc;
}
