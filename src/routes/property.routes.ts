import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { wordPressService } from '../services/wordpress.service';

export async function propertyRoutes(app: FastifyInstance) {
  app.get('/api/properties', async (request, reply) => {
    const query = z
      .object({
        first: z.coerce.number().int().min(1).max(50).default(20),
        refresh: z.coerce.boolean().optional(),
      })
      .parse(request.query);

    const data = await wordPressService.listProperties(query.first, query.refresh === true);
    return reply.send({ success: true, data, cached: query.refresh !== true });
  });

  app.get('/api/properties/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(200) }).parse(request.params);
    const refresh = (request.query as { refresh?: string }).refresh === 'true';

    const data = await wordPressService.getPropertyBySlug(slug, refresh);
    if (!data) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      });
    }

    return reply.send({ success: true, data, cached: !refresh });
  });

  app.post('/api/admin/cache/invalidate', async (request, reply) => {
    const body = z
      .object({ slug: z.string().optional(), secret: z.string() })
      .parse(request.body);

    if (body.secret !== process.env.CACHE_INVALIDATION_SECRET) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid cache invalidation secret' },
      });
    }

    await wordPressService.invalidateCache(body.slug);
    return reply.send({ success: true, message: 'Cache invalidated' });
  });
}
