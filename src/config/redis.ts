import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/** Options for ioredis + BullMQ — Upstash needs rediss:// and TLS. */
export function buildRedisConnectionOptions(): RedisOptions {
  const parsed = new URL(env.REDIS_URL);
  const useTls = parsed.protocol === 'rediss:';

  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 10_000,
    keepAlive: 30_000,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    reconnectOnError: (err) =>
      err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT'),
    ...(useTls ? { tls: {} } : {}),
  };
}

export const redis = new Redis(buildRedisConnectionOptions());

redis.on('error', (err) => {
  if (err.message.includes('ECONNRESET')) {
    logger.warn('Redis connection reset — reconnecting');
    return;
  }
  logger.error({ err }, 'Redis connection error');
});

redis.on('connect', () => logger.info('Redis connected'));

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

export const bullmqConnection = buildRedisConnectionOptions();
