# Oracle Cloud Free Deployment Guide

Step-by-step guide to deploy **property-platform-backend** on Oracle Cloud **Always Free** Ubuntu VPS — $0/month, matches the Backend Dev Assessment requirements (Docker, PM2, Nginx, HTTPS).

**Estimated time:** 45–90 minutes (first time)

---

## What you will have at the end

```
Internet → Nginx (HTTPS) → PM2 (API + Worker) → Node :3000
                              ↓
                    Docker: PostgreSQL + Redis
```

**Live URL example:** `https://your-app.duckdns.org/health`

---

## Part 1 — Oracle Cloud account & VM

### 1.1 Create Oracle Cloud account

1. Go to [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/)
2. Sign up (credit card required for verification — **not charged** on Always Free resources)
3. Choose your home region (pick one close to you; **cannot change later**)

### 1.2 Generate an SSH key (on your Windows PC)

Open PowerShell:

```powershell
ssh-keygen -t ed25519 -C "oracle-deploy" -f "$env:USERPROFILE\.ssh\oracle_deploy"
```

Press Enter for no passphrase (or set one if you prefer).

Your **public key** is in: `C:\Users\<YOU>\.ssh\oracle_deploy.pub`

### 1.3 Create the VM instance

In Oracle Cloud Console:

1. **Menu → Compute → Instances → Create instance**
2. **Name:** `property-backend`
3. **Image:** Ubuntu 22.04 (Always Free eligible)
4. **Shape:** `VM.Standard.A1.Flex` (Ampere ARM — Always Free)
   - OCPUs: **2**
   - Memory: **12 GB** (or 1 OCPU / 6 GB if quota is tight)
5. **Networking:** use default VCN
6. **Public IP:** Assign a **public IPv4 address**
7. **SSH keys:** paste contents of `oracle_deploy.pub`
8. Click **Create**

Wait until state is **Running**. Copy the **Public IP address** (e.g. `123.45.67.89`).

### 1.4 Open firewall ports (Oracle Security List)

Oracle blocks traffic before it reaches your VM. You must open ports:

1. **Menu → Networking → Virtual cloud networks**
2. Click your VCN → **Security Lists** → default security list
3. **Add Ingress Rules:**

| Source CIDR | Protocol | Dest Port | Description |
|-------------|----------|-----------|-------------|
| `0.0.0.0/0` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80 | HTTP (Certbot + redirect) |
| `0.0.0.0/0` | TCP | 443 | HTTPS |

### 1.5 Connect via SSH

From PowerShell:

```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_deploy ubuntu@YOUR_PUBLIC_IP
```

Replace `YOUR_PUBLIC_IP` with the VM IP.

---

## Part 2 — Free domain (DuckDNS)

Certbot needs a domain name. Use [DuckDNS](https://www.duckdns.org/) (free):

1. Sign in with Google/GitHub
2. Create a subdomain, e.g. `sounderrajan-property`
3. Set **current IP** to your Oracle VM public IP
4. Your domain: `sounderrajan-property.duckdns.org`

> Use this domain everywhere below instead of `your-domain.com`.

---

## Part 3 — Server setup

Run these commands **on the VM** (as `ubuntu`).

### 3.1 Create non-root deploy user

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Switch to deploy user:

```bash
sudo su - deploy
```

### 3.2 System firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 3.3 Install Docker, Node.js 20, PM2, Nginx, Certbot

```bash
sudo apt update && sudo apt upgrade -y

# Docker
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker deploy
newgrp docker

# Node.js 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx git
```

---

## Part 4 — Deploy the application

### 4.1 Clone your repository

```bash
cd /home/deploy
git clone https://github.com/YOUR_USERNAME/property-platform-backend.git
cd property-platform-backend
```

Replace `YOUR_USERNAME` with your GitHub username.

### 4.2 Start PostgreSQL + Redis (Docker)

Create Docker env file:

```bash
cat > .env.docker << 'EOF'
POSTGRES_USER=property_user
POSTGRES_PASSWORD=CHANGE_ME_STRONG_DB_PASSWORD
POSTGRES_DB=property_db
REDIS_PASSWORD=CHANGE_ME_STRONG_REDIS_PASSWORD
EOF
```

Generate strong passwords:

```bash
openssl rand -hex 24
# Run twice — use one for DB, one for Redis
```

Edit `.env.docker` with your passwords:

```bash
nano .env.docker
```

Start only Postgres and Redis with localhost port binding:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d postgres redis
```

Expose ports to the host (required for PM2). Create override file:

```bash
cat > docker-compose.override.yml << 'EOF'
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"
  redis:
    ports:
      - "127.0.0.1:6379:6379"
EOF

docker compose -f docker-compose.prod.yml -f docker-compose.override.yml --env-file .env.docker up -d postgres redis
docker ps
```

Verify:

```bash
docker exec $(docker ps -qf name=postgres) pg_isready -U property_user
docker exec $(docker ps -qf name=redis) redis-cli -a YOUR_REDIS_PASSWORD ping
```

### 4.3 Configure application environment

```bash
cp .env.example .env
nano .env
```

Production `.env` example (update values):

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

DATABASE_URL=postgresql://property_user:YOUR_DB_PASSWORD@127.0.0.1:5432/property_db?schema=public
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@127.0.0.1:6379

RATE_LIMIT_MAX=60
RATE_LIMIT_ENQUIRY_MAX=10

CRM_WEBHOOK_SECRET=PASTE_64_CHAR_RANDOM_SECRET_HERE
CACHE_INVALIDATION_SECRET=PASTE_RANDOM_SECRET_HERE

WORDPRESS_GRAPHQL_URL=https://your-wp-site.com/graphql
WORDPRESS_CACHE_TTL_SECONDS=300
IDEMPOTENCY_TTL_SECONDS=86400
LOG_LEVEL=info
```

Generate secrets:

```bash
openssl rand -hex 32   # CRM_WEBHOOK_SECRET
openssl rand -hex 16   # CACHE_INVALIDATION_SECRET
```

### 4.4 Build, migrate, start PM2

```bash
npm ci --omit=dev
npm run build
npx prisma migrate deploy

mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

PM2 prints a `sudo env PATH=...` command — **copy and run it**, then:

```bash
pm2 save
```

Verify API locally:

```bash
curl http://127.0.0.1:3000/health
```

Expected: JSON with `"status":"ok"` and database/redis connected.

```bash
pm2 list
```

You should see `property-api` (2 instances) and `property-worker` (1 instance).

---

## Part 5 — Nginx + HTTPS

### 5.1 Configure Nginx

```bash
sudo cp nginx/property-platform.conf /etc/nginx/sites-available/property-platform
sudo nano /etc/nginx/sites-available/property-platform
```

Replace **all** `your-domain.com` with your DuckDNS domain, e.g. `sounderrajan-property.duckdns.org`.

```bash
sudo ln -sf /etc/nginx/sites-available/property-platform /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 5.2 Obtain SSL certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d sounderrajan-property.duckdns.org
```

Follow prompts (email, agree to terms). Certbot configures HTTPS automatically.

Test renewal:

```bash
sudo certbot renew --dry-run
```

### 5.3 Test live HTTPS

From your PC:

```powershell
curl https://sounderrajan-property.duckdns.org/health
```

Or open in browser — you should see the padlock icon.

---

## Part 6 — Submission screenshots

Create folder and capture (on VM or PC):

```bash
mkdir -p /home/deploy/property-platform-backend/screenshots
```

| File | Command / action |
|------|------------------|
| `health.png` | Browser or curl output of `https://YOUR_DOMAIN/health` |
| `pm2-list.png` | `pm2 list` |
| `docker-ps.png` | `docker ps` |
| `https-padlock.png` | Browser address bar showing HTTPS |
| `nginx-ssl.png` | `sudo cat /etc/nginx/sites-enabled/property-platform` (SSL section) |

Copy screenshots to your repo locally, then commit:

```bash
git add screenshots/
git commit -m "Add deployment screenshots"
git push
```

---

## Part 7 — Update README for submission

Edit `README.md`:

```markdown
**Live URL:** https://sounderrajan-property.duckdns.org
**GitHub:** https://github.com/YOUR_USERNAME/property-platform-backend
```

Check off the submission checklist items.

---

## Quick reference commands

| Task | Command |
|------|---------|
| View API logs | `pm2 logs property-api --lines 50` |
| View worker logs | `pm2 logs property-worker --lines 50` |
| Restart app | `pm2 reload ecosystem.config.js` |
| Docker status | `docker ps` |
| Nginx test | `sudo nginx -t` |
| Health check | `curl https://YOUR_DOMAIN/health` |

### Deploy updates after code changes

```bash
cd /home/deploy/property-platform-backend
git pull origin main
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 reload ecosystem.config.js
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Cannot SSH | Check Oracle Security List allows port 22; verify public IP |
| Cannot reach site | Open ports 80/443 in Oracle Security List + UFW |
| `502 Bad Gateway` | `pm2 list` — ensure API is online; `curl http://127.0.0.1:3000/health` |
| DB connection refused | `docker ps` — postgres running? Check `DATABASE_URL` password |
| Redis errors | Check `REDIS_URL` includes password: `redis://:PASSWORD@127.0.0.1:6379` |
| Certbot fails | DuckDNS IP must match VM public IP; port 80 must be open |
| ARM build slow | Normal on free tier; `npm run build` may take 2–5 min |
| Webhook 401 | Regenerate HMAC with production `CRM_WEBHOOK_SECRET` |

### Regenerate webhook signature (on your PC)

```bash
node scripts/generate-webhook-signature.js '{"event":"enquiry.synced","enquiryId":"<uuid>"}'
```

Use the printed value as header `X-Webhook-Signature`.

---

## Cost summary

| Resource | Cost |
|----------|------|
| Oracle Always Free VM (ARM) | **$0/month** |
| DuckDNS subdomain | **$0** |
| Let's Encrypt SSL | **$0** |
| GitHub repo | **$0** |

---

## Optional: keep DuckDNS IP updated

If Oracle reassigns your public IP after reboot, update DuckDNS:

```bash
# Install curl cron (example — replace token and domain)
echo '0 */6 * * * curl -s "https://www.duckdns.org/update?domains=sounderrajan-property&token=YOUR_DUCKDNS_TOKEN&ip="' | crontab -
```

Or reserve a **public IP** in Oracle Cloud (still free on Always Free tier) to avoid IP changes.

---

## Related docs

- [DEPLOYMENT.md](../DEPLOYMENT.md) — general VPS deployment
- [API.md](./API.md) — API reference
- [SECURITY_REPORT.md](../SECURITY_REPORT.md) — security submission
