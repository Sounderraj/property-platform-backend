import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env, isProduction } from './config/env';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { errorHandler } from './middleware/error-handler';
import { enquiryRoutes } from './routes/enquiry.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { propertyRoutes } from './routes/property.routes';
import { healthRoutes } from './routes/health.routes';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 1048576,
  });

  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        (req as { rawBody?: string }).rawBody = body as string;
        const parsed = body ? JSON.parse(body as string) : {};
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  await app.register(helmet, {
    contentSecurityPolicy: isProduction,
  });

  await app.register(cors, {
    origin: isProduction ? false : true,
    methods: ['GET', 'POST'],
  });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    redis,
  });

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(enquiryRoutes);
  await app.register(webhookRoutes);
  await app.register(propertyRoutes);

  return app;
}

export async function startServer() {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');

  return app;
}
