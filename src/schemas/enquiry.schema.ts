import { z } from 'zod';

export const createEnquirySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional(),
  message: z.string().min(10).max(5000),
  propertyRef: z.string().max(100).optional(),
  source: z.string().max(50).optional().default('web'),
});

export const enquiryIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listEnquiriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'SYNCED', 'FAILED']).optional(),
});

export const crmWebhookSchema = z.object({
  event: z.enum(['enquiry.created', 'enquiry.updated', 'enquiry.synced']),
  enquiryId: z.string().uuid().optional(),
  externalId: z.string().max(100).optional(),
  data: z.record(z.unknown()).optional(),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type CrmWebhookInput = z.infer<typeof crmWebhookSchema>;
