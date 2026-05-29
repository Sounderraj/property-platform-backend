import { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { isRedisEnabled } from '../config/env';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const [database, redis] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const redisOk = redis === 'disabled' || redis === true;
    const healthy = database && redisOk;
    const status = {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis: isRedisEnabled ? redis : 'disabled',
      },
    };

    return reply.status(healthy ? 200 : 503).send(status);
  });
}
