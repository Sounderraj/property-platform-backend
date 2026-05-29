import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z
    .string()
    .default('redis://localhost:6379')
    .refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'), {
      message: 'REDIS_URL must start with redis:// or rediss://',
    })
    .refine((url) => !url.includes('redis-cli'), {
      message:
        'REDIS_URL must be the Upstash "Redis URL" only — do not paste the redis-cli command',
    }),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
  RATE_LIMIT_ENQUIRY_MAX: z.coerce.number().default(10),
  CRM_WEBHOOK_SECRET: z.string().min(8),
  WORDPRESS_GRAPHQL_URL: z.string().url().optional(),
  WORDPRESS_CACHE_TTL_SECONDS: z.coerce.number().default(300),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86400),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
