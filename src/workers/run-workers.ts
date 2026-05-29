import { Job, Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq';
import { logger } from '../config/logger';
import { deadLetterQueue } from '../queues';
import {
  processCrmSync,
  processEmail,
  processPushNotification,
  processCrmWebhook,
} from '../services/async-jobs.service';
import { CrmWebhookInput } from '../schemas/enquiry.schema';

const connection = bullmqConnection!;

async function moveToDeadLetter(queueName: string, job: Job, error: Error) {
  await deadLetterQueue.add(
    'failed-job',
    {
      queue: queueName,
      jobId: job.id,
      data: job.data,
      error: error.message,
      failedAt: new Date().toISOString(),
    },
    { removeOnComplete: 100, removeOnFail: 50 }
  );
}

const crmSyncWorker = new Worker(
  'crm-sync',
  async (job) => {
    const { enquiryId } = job.data as { enquiryId: string };
    await processCrmSync(enquiryId);
    return { synced: true };
  },
  { connection, concurrency: 5 }
);

const emailWorker = new Worker(
  'email',
  async (job) => {
    const { enquiryId, email } = job.data as { enquiryId: string; email: string };
    await processEmail(enquiryId, email);
    return { sent: true };
  },
  { connection, concurrency: 10 }
);

const pushWorker = new Worker(
  'push-notification',
  async (job) => {
    const { enquiryId, propertyRef } = job.data as {
      enquiryId: string;
      propertyRef?: string;
    };
    await processPushNotification(enquiryId, propertyRef);
    return { pushed: true };
  },
  { connection, concurrency: 10 }
);

const crmWebhookWorker = new Worker(
  'crm-webhook',
  async (job) => {
    const { payload, payloadHash } = job.data as {
      payload: CrmWebhookInput;
      payloadHash: string;
    };
    await processCrmWebhook(payload, payloadHash);
    return { processed: true };
  },
  { connection, concurrency: 5 }
);

for (const [name, worker] of [
  ['crm-sync', crmSyncWorker],
  ['email', emailWorker],
  ['push-notification', pushWorker],
  ['crm-webhook', crmWebhookWorker],
] as const) {
  worker.on('failed', async (job, err) => {
    logger.error({ queue: name, jobId: job?.id, err }, 'Job failed');
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await moveToDeadLetter(name, job, err);
    }
  });
}

logger.info('Background workers started');

process.on('SIGTERM', async () => {
  await Promise.all([
    crmSyncWorker.close(),
    emailWorker.close(),
    pushWorker.close(),
    crmWebhookWorker.close(),
  ]);
  process.exit(0);
});
