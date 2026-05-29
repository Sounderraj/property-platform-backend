import { isRedisEnabled } from '../config/env';
import { logger } from '../config/logger';

if (!isRedisEnabled) {
  logger.info('USE_REDIS=false — worker not needed (jobs run inline in API)');
  process.exit(0);
}

import('./run-workers').catch((err) => {
  logger.fatal({ err }, 'Failed to start workers');
  process.exit(1);
});
