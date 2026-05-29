import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/** Shared Redis options for ioredis + BullMQ (Upstash requires TLS via rediss://). */
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
    retryStrategy: (times) => {
      if (times > 15) return null;
      return Math.min(times * 200, 3000);
    },
    ...(useTls ? { tls: {} } : {}),
  };
}

export const redis = new Redis(buildRedisConnectionOptions());

redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
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

// BullMQ uses the same connection settings (including TLS for Upstash)
export const bullmqConnection = buildRedisConnectionOptions();
