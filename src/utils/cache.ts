import { isRedisEnabled } from '../config/env';

const store = new Map<string, { value: string; expiresAt: number }>();

function isExpired(entry: { expiresAt: number }): boolean {
  return entry.expiresAt <= Date.now();
}

export async function memoryCacheGet(key: string): Promise<string | null> {
  const entry = store.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export async function memoryCacheSetex(
  key: string,
  ttlSeconds: number,
  value: string
): Promise<void> {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function memoryCacheDel(key: string): Promise<void> {
  store.delete(key);
}

export async function memoryCacheDelByPrefix(prefix: string): Promise<void> {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (isRedisEnabled) {
    const { redis } = await import('../config/redis');
    return redis.get(key);
  }
  return memoryCacheGet(key);
}

export async function cacheSetex(
  key: string,
  ttlSeconds: number,
  value: string
): Promise<void> {
  if (isRedisEnabled) {
    const { redis } = await import('../config/redis');
    await redis.setex(key, ttlSeconds, value);
    return;
  }
  await memoryCacheSetex(key, ttlSeconds, value);
}

export async function cacheDel(key: string): Promise<void> {
  if (isRedisEnabled) {
    const { redis } = await import('../config/redis');
    await redis.del(key);
    return;
  }
  await memoryCacheDel(key);
}

export async function cacheDelPropertyKeys(prefix: string): Promise<void> {
  if (isRedisEnabled) {
    const { redis } = await import('../config/redis');
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
    return;
  }
  await memoryCacheDelByPrefix(prefix);
}
