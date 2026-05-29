import { isRedisEnabled } from '../config/env';
import {
  processCrmSync,
  processEmail,
  processPushNotification,
  processCrmWebhook,
} from './async-jobs.service';
import { CrmWebhookInput } from '../schemas/enquiry.schema';

export async function dispatchEnquiryJobs(params: {
  enquiryId: string;
  email: string;
  propertyRef?: string | null;
}): Promise<void> {
  if (!isRedisEnabled) {
    await Promise.all([
      processCrmSync(params.enquiryId),
      processEmail(params.enquiryId, params.email),
      processPushNotification(params.enquiryId, params.propertyRef),
    ]);
    return;
  }

  const { crmSyncQueue, emailQueue, pushNotificationQueue } = await import('../queues');
  await Promise.all([
    crmSyncQueue.add('sync', { enquiryId: params.enquiryId }, { jobId: `crm-${params.enquiryId}` }),
    emailQueue.add('send', { enquiryId: params.enquiryId, email: params.email }, {
      jobId: `email-${params.enquiryId}`,
    }),
    pushNotificationQueue.add(
      'notify',
      { enquiryId: params.enquiryId, propertyRef: params.propertyRef },
      { jobId: `push-${params.enquiryId}` }
    ),
  ]);
}

export async function dispatchCrmWebhookJob(params: {
  payload: CrmWebhookInput;
  payloadHash: string;
}): Promise<string | number | undefined> {
  if (!isRedisEnabled) {
    await processCrmWebhook(params.payload, params.payloadHash);
    return undefined;
  }

  const { crmWebhookQueue } = await import('../queues');
  const job = await crmWebhookQueue.add(
    'process',
    { payload: params.payload, payloadHash: params.payloadHash },
    {
      jobId: `webhook-${params.payloadHash}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    }
  );
  return job.id;
}
