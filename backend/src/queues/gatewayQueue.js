import { Queue } from "bullmq";
import { getRedisConnection } from "./publishingQueue.js";

let gatewayQueue = null;

export function getGatewayQueue() {
  if (!gatewayQueue) {
    gatewayQueue = new Queue("gateway", { connection: getRedisConnection() });
  }
  return gatewayQueue;
}

export async function enqueueGatewayJob(name, data) {
  try {
    const q = getGatewayQueue();
    await q.add(name, data, {
      removeOnComplete: 200,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  } catch (err) {
    console.warn("[gatewayQueue] enqueue failed, inline fallback:", err?.message || err);
    return false;
  }
  return true;
}
