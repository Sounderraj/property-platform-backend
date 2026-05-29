import { startServer } from './app';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { disconnectRedis } from './config/redis';
import { isRedisEnabled } from './config/env';

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

async function shutdown() {
  await prisma.$disconnect();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (!isRedisEnabled) {
  logger.info('USE_REDIS=false — running without Redis/BullMQ (inline jobs + memory cache)');
}
