import { prisma } from '../config/database';
import { env } from '../config/env';

export class IdempotencyService {
  async getStoredResponse<T>(key: string): Promise<T | null> {
    const record = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!record) return null;
    if (record.expiresAt < new Date()) {
      await prisma.idempotencyKey.delete({ where: { key } }).catch(() => undefined);
      return null;
    }

    return record.response as T;
  }

  async storeResponse(key: string, response: unknown): Promise<void> {
    const expiresAt = new Date(Date.now() + env.IDEMPOTENCY_TTL_SECONDS * 1000);

    await prisma.idempotencyKey.upsert({
      where: { key },
      create: { key, response: response as object, expiresAt },
      update: { response: response as object, expiresAt },
    });
  }
}

export const idempotencyService = new IdempotencyService();
