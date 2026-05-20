import { Queue } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redisConnection = new IORedis(url, {
  maxRetriesPerRequest: null,
});

export const publishingQueue = new Queue("publishing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
