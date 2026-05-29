import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env, isProduction } from './config/env';
import { logger } from './config/logger';
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
    // In-memory store (single Render instance). Avoids extra Upstash connections.
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

  // Render injects PORT and requires binding to 0.0.0.0 (not 127.0.0.1)
  const port = Number(process.env.PORT) || env.PORT;
  const host = '0.0.0.0';

  await app.listen({ port, host });
  logger.info({ port, host, nodeEnv: env.NODE_ENV }, 'Server listening');

  return app;
}
