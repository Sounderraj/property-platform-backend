# Property Platform Backend

Production-ready backend for a high-traffic property platform. Built for the Backend Developer Assessment.

**Stack:** Node.js 20, TypeScript, Fastify, PostgreSQL, Prisma, Redis/BullMQ (optional)

**Live URL:** `https://property-platform-api.onrender.com`  
**GitHub:** https://github.com/Sounderraj/property-platform-backend

## Features

- REST APIs for enquiries and CRM webhooks
- Request validation, sanitisation, rate limiting, idempotency
- Duplicate enquiry detection (fingerprint + time window)
- Async processing: CRM sync, email, push (BullMQ when `USE_REDIS=true`, inline otherwise)
- WordPress WPGraphQL integration with caching
- Health checks, structured logging, Docker configuration

## Quick Start (Local)

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npx prisma migrate deploy
npm run dev
```

API: http://localhost:3000/health

With Redis locally, also run `npm run worker` in a second terminal and set `USE_REDIS=true` in `.env`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/enquiry` | Create enquiry |
| GET | `/api/enquiry/:id` | Get enquiry by ID |
| GET | `/api/enquiries` | Paginated list |
| POST | `/api/webhook/crm` | CRM webhook (HMAC signed) |
| GET | `/api/properties` | Properties (cached / mock) |
| GET | `/api/properties/:slug` | Single property |
| POST | `/api/admin/cache/invalidate` | Invalidate cache |

See [docs/API.md](docs/API.md) for request/response examples.

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Render, Docker, VPS
- [SECURITY_REPORT.md](SECURITY_REPORT.md) — security review + threat scenarios
- [docs/API.md](docs/API.md) — API reference
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — performance fixes

## Postman

Import `postman/Property-Platform-API.postman_collection.json`.

## Database Schema

See `prisma/schema.prisma` — tables: `enquiries`, `idempotency_keys`, `crm_webhook_logs`

## Submission Checklist

- [x] GitHub repository
- [x] Live HTTPS URL (Render)
- [x] README, DEPLOYMENT, SECURITY_REPORT, API docs
- [x] Docker configuration
- [x] Postman collection
- [ ] Screenshots in `screenshots/`

## Author

Sounderrajan — Backend Developer Assessment
