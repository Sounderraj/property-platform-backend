import Redis, { RedisOptions } from 'ioredis';
import { env, isRedisEnabled } from './env';
import { logger } from './logger';

function buildRedisConnectionOptions(): RedisOptions {
  const url = env.REDIS_URL!;
  const useTls = url.startsWith('rediss://');
  const parsed = new URL(url);

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

function createRedisClient(): Redis {
  const client = new Redis(buildRedisConnectionOptions());

  client.on('error', (err) => {
    if (err.message.includes('ECONNRESET')) {
      logger.warn('Redis connection reset — reconnecting');
      return;
    }
    logger.error({ err }, 'Redis connection error');
  });

  client.on('connect', () => logger.info('Redis connected'));
  return client;
}

export const redis = isRedisEnabled ? createRedisClient() : (null as unknown as Redis);

export async function checkRedisHealth(): Promise<boolean | 'disabled'> {
  if (!isRedisEnabled) return 'disabled';

  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

export const bullmqConnection = isRedisEnabled ? buildRedisConnectionOptions() : null;

export async function disconnectRedis(): Promise<void> {
  if (isRedisEnabled && redis) {
    redis.disconnect();
  }
}
