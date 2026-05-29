# Docker Deployment — DigitalOcean Ubuntu VPS

Deploy the **full stack** on one Ubuntu server with Docker (assessment-preferred setup):

```
Postgres + Redis + API + Worker + HTTPS (Caddy)
```

| | |
|--|--|
| **Provider** | [DigitalOcean](https://www.digitalocean.com/) (Ubuntu VPS) |
| **Cost** | ~$4–6/month (Basic Droplet) |
| **Live URL** | `https://your-domain.com` or `https://your-app.duckdns.org` |

---

## Step 1 — Create DigitalOcean account

1. Sign up at [digitalocean.com](https://www.digitalocean.com/)
2. Add a payment method
3. (Optional) New accounts often get **$200 credit for 60 days**

---

## Step 2 — Create a Droplet (Ubuntu VPS)

1. **Create → Droplets**
2. **Region:** closest to you (e.g. Bangalore `BLR1`)
3. **Image:** Ubuntu 22.04 LTS
4. **Size:** Basic → **Regular** → **$4/mo** (1 GB RAM) or **$6/mo** (1 GB, better for Docker build)
5. **Authentication:** SSH key (recommended)

   Generate on Windows (PowerShell) if needed:

   ```powershell
   ssh-keygen -t ed25519 -C "digitalocean" -f "$env:USERPROFILE\.ssh\digitalocean_deploy"
   ```

   Copy public key and paste in DigitalOcean:

   ```powershell
   Get-Content $env:USERPROFILE\.ssh\digitalocean_deploy.pub
   ```

6. **Hostname:** `property-backend`
7. Click **Create Droplet**
8. Copy the **Public IP** (e.g. `164.92.xxx.xxx`)

---

## Step 3 — Point a domain to the Droplet

Pick **one**:

### Option A — Your own domain
In your domain DNS (DigitalOcean, Cloudflare, etc.):

| Type | Name | Value |
|------|------|-------|
| A | `@` | Droplet IP |
| A | `api` | Droplet IP |

Use e.g. `api.yourdomain.com` in the Caddyfile below.

### Option B — Free subdomain (DuckDNS)
1. [duckdns.org](https://www.duckdns.org/) → create subdomain
2. Point it to your Droplet IP
3. Use e.g. `sounderrajan-property.duckdns.org`

---

## Step 4 — SSH into the Droplet

```powershell
ssh -i $env:USERPROFILE\.ssh\digitalocean_deploy root@YOUR_DROPLET_IP
```

(DigitalOcean default user is `root` unless you chose another.)

Enable firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## Step 5 — Install Docker

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git
```

Verify:

```bash
docker --version
docker compose version
```

---

## Step 6 — Clone your repo

```bash
cd /root
git clone https://github.com/Sounderraj/property-platform-backend.git
cd property-platform-backend
```

---

## Step 7 — Configure environment

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```env
NODE_ENV=production
CRM_WEBHOOK_SECRET=paste-64-char-random-secret-here
CACHE_INVALIDATION_SECRET=paste-random-secret-here
```

Generate secrets:

```bash
openssl rand -hex 32
openssl rand -hex 16
```

Optional — stronger DB password:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
```

(`DATABASE_URL` and `REDIS_URL` are set automatically by `docker-compose.deploy.yml`.)

---

## Step 8 — Configure HTTPS (Caddy)

```bash
cp Caddyfile.example Caddyfile
nano Caddyfile
```

Replace with your domain:

```
api.yourdomain.com {
    reverse_proxy api:3000
}
```

Or DuckDNS:

```
sounderrajan-property.duckdns.org {
    reverse_proxy api:3000
}
```

---

## Step 9 — Start everything

```bash
docker compose -f docker-compose.deploy.yml up -d --build
```

First build takes 3–5 minutes.

Check:

```bash
docker ps
docker compose -f docker-compose.deploy.yml logs -f api
```

Expected: **5 containers** — `postgres`, `redis`, `api`, `worker`, `caddy`.

---

## Step 10 — Test & submit

```bash
curl https://api.yourdomain.com/health
```

Expected:

```json
{"status":"ok","database":"connected","redis":"connected"}
```

Update `README.md`:

```markdown
**Live URL:** https://api.yourdomain.com
```

### Screenshots for submission

Save to `screenshots/`:

1. `/health` response over HTTPS
2. `docker ps` — all 5 containers running
3. DigitalOcean Droplet dashboard
4. Browser HTTPS padlock

---

## Useful commands

| Task | Command |
|------|---------|
| View logs | `docker compose -f docker-compose.deploy.yml logs -f` |
| Restart | `docker compose -f docker-compose.deploy.yml restart` |
| Stop | `docker compose -f docker-compose.deploy.yml down` |
| Update app | `git pull && docker compose -f docker-compose.deploy.yml up -d --build` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site not loading | DNS A record must point to Droplet IP; wait 5–15 min for DNS |
| SSL error | Port 80 must be open (Caddy needs it for certificate) |
| API container exits | `docker logs property-api` — check `.env` secrets |
| Out of memory on build | Upgrade to $6/mo Droplet or add 1 GB swap |

---

## What runs in Docker

| Container | Role |
|-----------|------|
| `property-postgres` | PostgreSQL |
| `property-redis` | Redis (queues + rate limit) |
| `property-api` | REST API |
| `property-worker` | BullMQ background jobs |
| `property-caddy` | HTTPS reverse proxy (Let's Encrypt) |

**One Droplet. One command. Matches assessment requirements.**

---

## After assessment

Delete the Droplet in DigitalOcean dashboard to stop billing:

**Droplets → property-backend → Destroy**

---

## Related

- [DEPLOYMENT.md](../DEPLOYMENT.md) — PM2 + Nginx alternative
- [API.md](./API.md) — API reference
