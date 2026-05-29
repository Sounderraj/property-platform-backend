import { FastifyInstance } from 'fastify';
import { crmWebhookService } from '../services/crm-webhook.service';
import { crmWebhookSchema } from '../schemas/enquiry.schema';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/webhook/crm', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const rawBody = (request as { rawBody?: string }).rawBody ?? JSON.stringify(request.body);
    const signature = request.headers['x-webhook-signature'] as string | undefined;

    crmWebhookService.verifySignature(rawBody, signature);

    const payload = crmWebhookSchema.parse(
      typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    );

    const result = await crmWebhookService.process(payload, rawBody);
    return reply.status(202).send({ success: true, data: result });
  });
}
