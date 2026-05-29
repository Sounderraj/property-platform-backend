import { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const [database, redis] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const healthy = database && redis;
    const status = {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };

    return reply.status(healthy ? 200 : 503).send(status);
  });
}
