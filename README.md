# Property Platform Backend

Production-ready backend for a high-traffic property platform. Built for the Backend Developer Assessment.

**Stack:** Node.js 20, TypeScript, Fastify, PostgreSQL, Prisma, Redis, BullMQ

## Features

- REST APIs for enquiries and CRM webhooks
- Request validation, sanitisation, rate limiting, idempotency
- Duplicate enquiry detection (fingerprint + time window)
- Async processing: CRM sync, email, push notifications (BullMQ)
- WordPress WPGraphQL integration with Redis caching
- Health checks, structured logging, Docker deployment

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres + Redis)

### 1. Clone and install

```bash
cd property-platform-backend
cp .env.example .env
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Run migrations

```bash
npx prisma migrate deploy
npm run db:seed
```

### 4. Start API and worker (two terminals)

```bash
npm run dev
npm run worker
```

API: http://localhost:3000  
Health: http://localhost:3000/health

### 5. Full Docker stack

```bash
docker compose up --build
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (DB + Redis) |
| POST | `/api/enquiry` | Create enquiry |
| GET | `/api/enquiry/:id` | Get enquiry by ID |
| GET | `/api/enquiries` | Paginated list (`page`, `limit`, `status`) |
| POST | `/api/webhook/crm` | CRM webhook (HMAC signed) |
| GET | `/api/properties` | Properties from WordPress (cached) |
| GET | `/api/properties/:slug` | Single property |
| POST | `/api/admin/cache/invalidate` | Invalidate WP cache |

See [docs/API.md](docs/API.md) for full request/response examples.

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CRM_WEBHOOK_SECRET` | HMAC secret for webhook verification |
| `WORDPRESS_GRAPHQL_URL` | WPGraphQL endpoint |
| `RATE_LIMIT_MAX` | Global requests/minute per IP |
| `CACHE_INVALIDATION_SECRET` | Secret for cache invalidation endpoint |

## Webhook Signature

```bash
node scripts/generate-webhook-signature.js '{"event":"enquiry.synced","enquiryId":"<uuid>"}'
```

Send the output as header `X-Webhook-Signature`.

## Project Structure

```
src/
  config/       # env, db, redis, logger
  middleware/   # error handler
  routes/       # HTTP routes
  services/     # business logic
  queues/       # BullMQ queues
  workers/      # background job processors
  schemas/      # Zod validation
prisma/         # schema + migrations
docker/         # (compose at root)
nginx/          # reverse proxy config
postman/        # API collection
docs/           # API + performance notes
```

## Database Schema

See `prisma/schema.prisma` and `prisma/migrations/`.

**Tables:** `enquiries`, `idempotency_keys`, `crm_webhook_logs`

**Indexes:** email+created_at, fingerprint, property_ref, pagination on created_at

## Async Workflows

On `POST /api/enquiry`, three BullMQ jobs are queued:

1. **crm-sync** — updates enquiry status PENDING → PROCESSING → SYNCED
2. **email** — simulated notification email
3. **push-notification** — simulated push alert

CRM webhooks are processed asynchronously with retry + dead-letter queue.

## Documentation

- [docs/ORACLE_CLOUD_DEPLOYMENT.md](docs/ORACLE_CLOUD_DEPLOYMENT.md) — **Free deployment** on Oracle Cloud Always Free VPS
- [DEPLOYMENT.md](DEPLOYMENT.md) — VPS, Docker, PM2, Nginx, HTTPS
- [SECURITY_REPORT.md](SECURITY_REPORT.md) — vulnerabilities + threat scenarios
- [docs/API.md](docs/API.md) — API reference
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — performance issues & fixes

## Postman

Import `postman/Property-Platform-API.postman_collection.json`.

## Submission Checklist

- [ ] Deploy to VPS with HTTPS (update live URL here)
- [ ] Push to GitHub
- [ ] Add screenshots to `screenshots/`
- [ ] Fill live URL in README

**Live URL:** `https://your-domain.com` (update after deployment)

**GitHub:** `https://github.com/your-username/property-platform-backend`

## Author

Sounderrajan — Backend Developer Assessment
