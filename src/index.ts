import { startServer } from './app';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

async function shutdown() {
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
