import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { CrmWebhookInput } from '../schemas/enquiry.schema';

export async function processCrmSync(enquiryId: string): Promise<void> {
  logger.info({ enquiryId }, 'CRM sync started (inline)');

  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { status: 'PROCESSING' },
  });

  await new Promise((r) => setTimeout(r, 500));

  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { status: 'SYNCED' },
  });

  logger.info({ enquiryId }, 'CRM sync completed (inline)');
}

export async function processEmail(enquiryId: string, email: string): Promise<void> {
  logger.info({ enquiryId, email }, 'Enquiry email sent (inline, simulated)');
  await new Promise((r) => setTimeout(r, 200));
}

export async function processPushNotification(
  enquiryId: string,
  propertyRef?: string | null
): Promise<void> {
  logger.info({ enquiryId, propertyRef }, 'Push notification sent (inline, simulated)');
}

export async function processCrmWebhook(
  payload: CrmWebhookInput,
  payloadHash: string
): Promise<void> {
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

  logger.info({ payloadHash, event: payload.event }, 'CRM webhook processed (inline)');
}
