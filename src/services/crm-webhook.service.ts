import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { CrmWebhookInput } from '../schemas/enquiry.schema';
import { hashPayload } from '../utils/fingerprint';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { dispatchCrmWebhookJob } from './job-dispatcher.service';

export class CrmWebhookService {
  verifySignature(rawBody: string, signature: string | undefined): void {
    if (!signature) {
      throw new UnauthorizedError('Missing webhook signature');
    }

    const normalizedSig = signature.trim().replace(/^sha256=/i, '').toLowerCase();

    const expected = createHmac('sha256', env.CRM_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(normalizedSig, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

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

    const jobId = await dispatchCrmWebhookJob({ payload, payloadHash });

    return {
      accepted: true,
      jobId,
      payloadHash,
    };
  }
}

export const crmWebhookService = new CrmWebhookService();
