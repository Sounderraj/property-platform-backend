import { FastifyInstance } from 'fastify';
import { enquiryService } from '../services/enquiry.service';
import { idempotencyService } from '../services/idempotency.service';
import {
  createEnquirySchema,
  enquiryIdParamSchema,
  listEnquiriesQuerySchema,
} from '../schemas/enquiry.schema';

export async function enquiryRoutes(app: FastifyInstance) {
  app.post('/api/enquiry', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    if (idempotencyKey) {
      const cached = await idempotencyService.getStoredResponse<{
        success: boolean;
        data: unknown;
      }>(idempotencyKey);
      if (cached) {
        return reply.status(201).send(cached);
      }
    }

    const body = createEnquirySchema.parse(request.body);
    const data = await enquiryService.create(body);
    const response = { success: true, data };

    if (idempotencyKey) {
      await idempotencyService.storeResponse(idempotencyKey, response);
    }

    return reply.status(201).send(response);
  });

  app.get('/api/enquiry/:id', async (request, reply) => {
    const { id } = enquiryIdParamSchema.parse(request.params);
    const data = await enquiryService.getById(id);
    return reply.send({ success: true, data });
  });

  app.get('/api/enquiries', async (request, reply) => {
    const query = listEnquiriesQuerySchema.parse(request.query);
    const result = await enquiryService.list(query);
    return reply.send({ success: true, ...result });
  });
}
