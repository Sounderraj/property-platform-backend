# Simple Free Deployment (subdomain + HTTPS)

Deploy in ~20 minutes. **No VPS, no Nginx, no PM2 setup.**

You get a free URL like:

```
https://property-platform-api.onrender.com
```

| Service | Role | Cost |
|---------|------|------|
| [Render](https://render.com) | API + Worker + HTTPS subdomain | Free |
| [Neon](https://neon.tech) | PostgreSQL database | Free |
| [Upstash](https://upstash.com) | Redis (queues + rate limit) | Free |

---

## Step 1 — Neon (PostgreSQL)

1. Sign up at [neon.tech](https://neon.tech)
2. **New Project** → name: `property-platform`
3. Copy the **connection string** (starts with `postgresql://...`)
4. Keep it — you need it in Step 4

---

## Step 2 — Upstash (Redis)

1. Sign up at [upstash.com](https://upstash.com)
2. **Create database** → type: **Regional**, name: `property-redis`
3. On the database page, find **Redis URL** (tab: **Details** or **Connect**)
4. Copy **only** the URL — it looks like:

```
rediss://default:YOUR_PASSWORD@your-name-12345.upstash.io:6379
```

**Do NOT copy** the `redis-cli` command. Wrong example (will crash):

```
redis-cli --tls -u redis://default:...@....upstash.io:6379   ❌
```

**Correct** — paste only this into Render `REDIS_URL`:

```
rediss://default:YOUR_PASSWORD@your-name-12345.upstash.io:6379   ✅
```

> Use `rediss://` (with double **s**) — Upstash requires TLS.

---

## Step 3 — Generate secrets

On your PC (PowerShell):

```powershell
# Run twice — save both outputs
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Or use any long random string (min 32 chars for webhook secret).

You need:
- `CRM_WEBHOOK_SECRET` — e.g. 64 random characters
- `CACHE_INVALIDATION_SECRET` — e.g. 32 random characters

---

## Step 4 — Deploy on Render

1. Sign up at [render.com](https://render.com) (use **GitHub** login)
2. **New +** → **Blueprint**
3. Connect repo: `Sounderraj/property-platform-backend`
4. Render detects `render.yaml` → click **Apply**
5. When asked for environment variables, paste:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon connection string from Step 1 |
| `REDIS_URL` | Upstash URL from Step 2 |
| `CRM_WEBHOOK_SECRET` | Your random secret |
| `CACHE_INVALIDATION_SECRET` | Your random secret |

6. Wait ~5–10 min for both services to deploy (API + Worker)

> **Important:** You need **two** services on Render:
> - **Web Service** → `property-platform-api` (opens HTTP port)
> - **Background Worker** → `property-platform-worker` (no port — do NOT create as Web Service)
>
> If you see *"Port scan timeout"* on the worker, change its type to **Background Worker** in Render settings.

---

## Step 5 — Test live API

Your URL is shown on the Render dashboard (Web Service → URL).

```powershell
curl https://property-platform-api.onrender.com/health
```

Expected:

```json
{"status":"ok","database":"connected","redis":"connected"}
```

Test create enquiry:

```powershell
curl -X POST https://property-platform-api.onrender.com/api/enquiry `
  -H "Content-Type: application/json" `
  -d '{"name":"Test User","email":"test@example.com","message":"Hello from live deploy!!!!"}'
```

---

## Step 6 — Update README for submission

Edit `README.md`:

```markdown
**Live URL:** https://property-platform-api.onrender.com
**GitHub:** https://github.com/Sounderraj/property-platform-backend
```

Take screenshots:
- Browser/curl showing `/health` response
- Render dashboard showing both services **Live**
- GitHub repo page

Save to `screenshots/` folder and push to GitHub.

---

## Notes

| Topic | Detail |
|-------|--------|
| **Free tier sleep** | Render free API sleeps after ~15 min idle. First request may take 30–60 sec (cold start). Normal for free tier. |
| **HTTPS** | Automatic — Render gives free SSL on `.onrender.com` |
| **WordPress** | Optional — set `WORDPRESS_GRAPHQL_URL` in Render env if you have WP; otherwise properties use mock data |
| **Webhook secret** | Must be the **same** on API and Worker services (Blueprint sets both if you paste once) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on `prisma migrate` | Check `DATABASE_URL` is correct and Neon project is active |
| Redis connection error / ECONNRESET | Use `rediss://` URL (TLS). Do not use `redis://` or REST URL |
| 502 / service unavailable | Wait for deploy to finish; check Render logs |
| Worker not processing jobs | Ensure **Worker** service is Live (not just API) |
| Slow first request | Free tier cold start — wait and retry |

---

## Manual deploy (without Blueprint)

If Blueprint does not work, create **two** services manually:

### Web Service (API)

- **Build:** `npm ci && npm run build && npx prisma migrate deploy`
- **Start:** `npm start`
- **Health check path:** `/health`

### Background Worker

- **Build:** `npm ci && npm run build`
- **Start:** `npm run worker:prod`

Add the same env vars to **both** services.

---

## Related

- [API.md](./API.md) — endpoints
- [DEPLOYMENT.md](../DEPLOYMENT.md) — full VPS deploy (optional)
- [SECURITY_REPORT.md](../SECURITY_REPORT.md) — security submission
