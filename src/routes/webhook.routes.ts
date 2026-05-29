import { FastifyInstance } from 'fastify';
import { crmWebhookService } from '../services/crm-webhook.service';
import { crmWebhookSchema } from '../schemas/enquiry.schema';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/webhook/crm', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const rawBody = (request as { rawBody?: string }).rawBody;
    if (!rawBody) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing raw JSON body for signature verification' },
      });
    }
    const signature = request.headers['x-webhook-signature'] as string | undefined;

    crmWebhookService.verifySignature(rawBody, signature);

    const payload = crmWebhookSchema.parse(request.body);

    const result = await crmWebhookService.process(payload, rawBody);
    return reply.status(202).send({ success: true, data: result });
  });
}
