import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    USE_REDIS: z
      .string()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().optional(),
    RATE_LIMIT_MAX: z.coerce.number().default(60),
    RATE_LIMIT_ENQUIRY_MAX: z.coerce.number().default(10),
    CRM_WEBHOOK_SECRET: z.string().min(8),
    WORDPRESS_GRAPHQL_URL: z.string().url().optional(),
    WORDPRESS_CACHE_TTL_SECONDS: z.coerce.number().default(300),
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86400),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((data, ctx) => {
    if (!data.USE_REDIS) return;

    if (!data.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL is required when USE_REDIS=true',
        path: ['REDIS_URL'],
      });
      return;
    }

    if (!data.REDIS_URL.startsWith('redis://') && !data.REDIS_URL.startsWith('rediss://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL must start with redis:// or rediss://',
        path: ['REDIS_URL'],
      });
    }

    if (data.REDIS_URL.includes('redis-cli')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL must be the Upstash Redis URL only — not the redis-cli command',
        path: ['REDIS_URL'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isRedisEnabled = env.USE_REDIS;
