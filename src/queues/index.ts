import { Queue } from 'bullmq';
import { bullmqConnection } from '../config/bullmq';

export const crmSyncQueue = new Queue('crm-sync', { connection: bullmqConnection });
export const emailQueue = new Queue('email', { connection: bullmqConnection });
export const pushNotificationQueue = new Queue('push-notification', {
  connection: bullmqConnection,
});
export const crmWebhookQueue = new Queue('crm-webhook', { connection: bullmqConnection });
export const deadLetterQueue = new Queue('dead-letter', { connection: bullmqConnection });
