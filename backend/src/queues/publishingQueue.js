import { Queue } from "bullmq";

let lastQueueErrorLogged = 0;

const redisConnection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    // Retry every 10 seconds to avoid spamming connection attempts
    return 10000;
  }
};

export const publishQueue = new Queue('publish', {
  connection: redisConnection
});

publishQueue.on('error', (err) => {
  const now = Date.now();
  if (now - lastQueueErrorLogged > 10000) {
    console.error('[Queue] Redis connection error:', err.message || err);
    lastQueueErrorLogged = now;
  }
});

// Helper functions for backward compatibility
export function getPublishingQueue() {
  return publishQueue;
}

export function getRedisConnection() {
  return redisConnection;
}
