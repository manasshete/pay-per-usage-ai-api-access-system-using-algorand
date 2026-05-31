import { enqueueGatewayJob } from "../queues/gatewayQueue.js";
import { bumpPeriodCounters } from "../services/gatewayPeriodStats.js";

export async function updateGatewayAnalytics(payload) {
  const queued = await enqueueGatewayJob("analyticsBump", payload);
  if (queued) return;
  await bumpPeriodCounters(payload);
}
