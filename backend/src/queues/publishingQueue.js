import { Queue } from "bullmq";

let lastQueueErrorLogged = 0;

let connectionOptions = {};
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

try {
  const parsed = new URL(redisUrl);
  connectionOptions = {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname ? Number(parsed.pathname.split('/')[1]) : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
} catch (e) {
  console.error('[Queue] Failed to parse REDIS_URL, using default localhost:', e.message);
  connectionOptions = {
    host: 'localhost',
    port: 6379
  };
}

const redisConnection = {
  ...connectionOptions,
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
