import { ProxyApi } from "../models/ProxyApi.js";
import { AlertConfig } from "../models/AlertConfig.js";
import { redisGet } from "./redisClient.js";
import { todayUtc } from "./gatewayPeriodStats.js";

const ERROR_RATE_THRESHOLD = Number(process.env.GATEWAY_API_ERROR_RATE_THRESHOLD || 0.2);
const MIN_CALLS_FOR_ALERT = Number(process.env.GATEWAY_API_MIN_CALLS_ALERT || 5);

export async function scanApiHealthAndAlert() {
  const day = todayUtc();
  const apis = await ProxyApi.find({ isActive: true }).select("developerId name").lean();
  let alerted = 0;

  for (const api of apis) {
    const calls = parseInt((await redisGet(`api:${api._id}:calls:daily:${day}`)) || "0", 10);
    const errors = parseInt((await redisGet(`api:${api._id}:errors:daily:${day}`)) || "0", 10);
    if (calls < MIN_CALLS_FOR_ALERT) continue;
    const rate = errors / calls;
    if (rate < ERROR_RATE_THRESHOLD) continue;

    const configs = await AlertConfig.find({
      userId: api.developerId,
      type: "api_outage",
      isActive: true,
    }).lean();

    for (const cfg of configs) {
      const cooldownMs = 3600000;
      if (cfg.lastTriggeredAt && Date.now() - new Date(cfg.lastTriggeredAt).getTime() < cooldownMs) {
        continue;
      }
      await AlertConfig.updateOne({ _id: cfg._id }, { $set: { lastTriggeredAt: new Date() } });
      console.warn(
        `[gatewayHealth] api_outage api=${api.name} developer=${api.developerId} errorRate=${(rate * 100).toFixed(1)}%`
      );
      alerted += 1;
    }
  }
  return { scanned: apis.length, alerted };
}
