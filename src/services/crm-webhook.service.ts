import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { CrmWebhookInput } from '../schemas/enquiry.schema';
import { hashPayload } from '../utils/fingerprint';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { crmWebhookQueue } from '../queues';

export class CrmWebhookService {
  verifySignature(rawBody: string, signature: string | undefined): void {
    if (!signature) {
      throw new UnauthorizedError('Missing webhook signature');
    }

    const expected = createHmac('sha256', env.CRM_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedError('Invalid webhook signature');
    }
  }

  async process(payload: CrmWebhookInput, rawBody: string) {
    const payloadHash = hashPayload(payload);

    try {
      await prisma.crmWebhookLog.create({
        data: {
          enquiryId: payload.enquiryId,
          payloadHash,
          payload: payload as object,
          status: 'QUEUED',
        },
      });
    } catch {
      throw new ConflictError('Duplicate webhook payload already processed');
    }

    const job = await crmWebhookQueue.add(
      'process',
      { payload, payloadHash },
      {
        jobId: `webhook-${payloadHash}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      }
    );

    return {
      accepted: true,
      jobId: job.id,
      payloadHash,
    };
  }
}

export const crmWebhookService = new CrmWebhookService();
