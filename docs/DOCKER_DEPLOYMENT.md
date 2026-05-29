# Docker Deployment (one host, one command)

Deploy the **full stack** on a single free server with Docker:

```
Postgres + Redis + API + Worker + HTTPS (Caddy)
```

**Cost:** $0 on [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)  
**Live URL:** `https://your-app.duckdns.org`

---

## Step 1 — Create free Oracle Cloud VM

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. **Compute → Instances → Create**
3. **Image:** Ubuntu 22.04
4. **Shape:** `VM.Standard.A1.Flex` (Always Free ARM)
5. **Public IP:** enable
6. Add your **SSH public key**
7. Create instance → copy **Public IP**

---

## Step 2 — Open firewall ports

In Oracle Console → **Networking → VCN → Security List → Ingress Rules**, add:

| Port | Purpose |
|------|---------|
| 22 | SSH |
| 80 | HTTP (SSL certificate) |
| 443 | HTTPS |

---

## Step 3 — Free subdomain (DuckDNS)

1. Sign up at [duckdns.org](https://www.duckdns.org/)
2. Create subdomain e.g. `sounderrajan-property`
3. Point it to your VM **Public IP**
4. Your domain: `sounderrajan-property.duckdns.org`

---

## Step 4 — SSH into the server

From your PC (PowerShell):

```powershell
ssh ubuntu@YOUR_PUBLIC_IP
```

---

## Step 5 — Install Docker

On the VM:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

---

## Step 6 — Clone your repo

```bash
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
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env
```

(`DATABASE_URL` / `REDIS_URL` are set automatically by `docker-compose.deploy.yml`.)

---

## Step 8 — Configure HTTPS domain

```bash
cp Caddyfile.example Caddyfile
nano Caddyfile
```

Replace `your-app.duckdns.org` with your real DuckDNS domain:

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

Wait 2–5 minutes for the first build.

Check status:

```bash
docker ps
docker compose -f docker-compose.deploy.yml logs -f api
```

You should see 5 containers: `postgres`, `redis`, `api`, `worker`, `caddy`.

---

## Step 10 — Test & submit

```bash
curl https://sounderrajan-property.duckdns.org/health
```

Expected:

```json
{"status":"ok","database":"connected","redis":"connected"}
```

Update `README.md`:

```markdown
**Live URL:** https://sounderrajan-property.duckdns.org
```

### Screenshots for submission

Save to `screenshots/`:

1. `curl` or browser showing `/health` over HTTPS
2. `docker ps` (all 5 containers running)
3. Browser padlock on your DuckDNS URL

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
| Site not loading | DuckDNS IP must match VM public IP; ports 80/443 open in Oracle |
| SSL certificate error | Wait 1–2 min after first start; ensure port 80 is reachable |
| API container exits | `docker logs property-api` — check `.env` secrets |
| Build fails on ARM | Normal on Oracle ARM — first build may take 5+ minutes |

---

## What runs in Docker

| Container | Role |
|-----------|------|
| `property-postgres` | PostgreSQL database |
| `property-redis` | Redis (queues + rate limit) |
| `property-api` | REST API |
| `property-worker` | BullMQ background jobs |
| `property-caddy` | HTTPS reverse proxy (free SSL) |

**One signup. One server. One command.**

---

## Related

- [DEPLOYMENT.md](../DEPLOYMENT.md) — PM2 + Nginx alternative (assessment-style VPS)
- [API.md](./API.md) — API reference
