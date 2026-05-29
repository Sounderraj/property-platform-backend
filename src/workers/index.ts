import { Job, Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { deadLetterQueue } from '../queues';
import { CrmWebhookInput } from '../schemas/enquiry.schema';

const connection = bullmqConnection;

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
    logger.info({ enquiryId, jobId: job.id }, 'CRM sync started');

    await prisma.enquiry.update({
      where: { id: enquiryId },
      data: { status: 'PROCESSING' },
    });

    await new Promise((r) => setTimeout(r, 500));

    await prisma.enquiry.update({
      where: { id: enquiryId },
      data: { status: 'SYNCED' },
    });

    logger.info({ enquiryId }, 'CRM sync completed');
    return { synced: true };
  },
  { connection, concurrency: 5 }
);

const emailWorker = new Worker(
  'email',
  async (job) => {
    const { enquiryId, email } = job.data as { enquiryId: string; email: string };
    logger.info({ enquiryId, email }, 'Sending enquiry notification email (simulated)');
    await new Promise((r) => setTimeout(r, 200));
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
    logger.info({ enquiryId, propertyRef }, 'Push notification sent (simulated)');
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

    if (payload.enquiryId) {
      const status =
        payload.event === 'enquiry.synced'
          ? 'SYNCED'
          : payload.event === 'enquiry.updated'
            ? 'PROCESSING'
            : 'PENDING';

      await prisma.enquiry.updateMany({
        where: { id: payload.enquiryId },
        data: { status },
      });
    }

    await prisma.crmWebhookLog.updateMany({
      where: { payloadHash },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });

    logger.info({ payloadHash, event: payload.event }, 'CRM webhook processed');
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
