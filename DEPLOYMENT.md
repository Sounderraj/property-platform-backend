# Deployment Guide

## Live production (Render + Neon)

| Service | Role |
|---------|------|
| [Render](https://render.com) | API + HTTPS (`*.onrender.com`) |
| [Neon](https://neon.tech) | PostgreSQL |

**No Redis required** — set `USE_REDIS=false` (default in `render.yaml`). Jobs run inline; cache uses memory.

### Steps

1. Create Neon project → copy `DATABASE_URL`
2. Generate secrets: `CRM_WEBHOOK_SECRET`, `CACHE_INVALIDATION_SECRET` (min 32 chars)
3. Render → **New → Blueprint** → connect repo `Sounderraj/property-platform-backend`
4. Paste env vars when prompted
5. Deploy → test `GET /health`

### Render environment

| Variable | Required |
|----------|----------|
| `USE_REDIS` | `false` |
| `DATABASE_URL` | Neon connection string |
| `CRM_WEBHOOK_SECRET` | Yes |
| `CACHE_INVALIDATION_SECRET` | Yes |

Build command: `npm ci --include=dev && npm run build && npx prisma migrate deploy`  
Start command: `npm start`

---

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npx prisma migrate deploy
npm run dev          # terminal 1
npm run worker       # terminal 2 (only if USE_REDIS=true)
```

Set `USE_REDIS=true` and `REDIS_URL=redis://localhost:6379` in `.env` for BullMQ locally.

---

## Docker (local / VPS)

```bash
docker compose up --build
```

Includes Postgres, Redis, API, and worker. See `Dockerfile` and `docker-compose.yml`.

---

## VPS alternative (PM2 + Nginx)

For Ubuntu VPS (DigitalOcean etc.):

1. Install Node 20, Docker, PM2, Nginx
2. `docker compose up -d postgres redis`
3. `npm ci --omit=dev && npm run build && npx prisma migrate deploy`
4. `pm2 start ecosystem.config.js`
5. Copy `nginx/property-platform.conf` → enable site → Certbot HTTPS

See `ecosystem.config.js` and `nginx/property-platform.conf`.

---

## Seed sample data

```bash
npm run seed:100
```

Inserts 100 random enquiries into the database (requires `DATABASE_URL`).

---

## Updates

```bash
git pull origin main
npm ci --include=dev && npm run build
npx prisma migrate deploy
# Render: auto-deploy from GitHub
# PM2: pm2 reload ecosystem.config.js
```
