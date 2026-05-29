# Deployment Guide

Deploy the Property Platform Backend to an Ubuntu VPS (DigitalOcean recommended).

## Architecture

```
Internet → Nginx (443/HTTPS) → PM2 (cluster) → Node API :3000
                              ↓
                    Docker: PostgreSQL + Redis
                    PM2: property-worker
```

## 1. VPS Initial Setup

```bash
# As root on Ubuntu 22.04+
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Login as `deploy` (non-root) for all steps below.

## 2. Install Dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git

# Node.js 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 3. Clone Application

```bash
cd /home/deploy
git clone https://github.com/Sounderraj/property-platform-backend.git
cd property-platform-backend
```

## 4. Environment Configuration

```bash
cp .env.example .env
nano .env
```

Production `.env` example:

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgresql://property_user:STRONG_PASSWORD@localhost:5432/property_db
REDIS_URL=redis://:REDIS_PASSWORD@localhost:6379
CRM_WEBHOOK_SECRET=<64-char-random-secret>
CACHE_INVALIDATION_SECRET=<random-secret>
WORDPRESS_GRAPHQL_URL=https://your-wp-site.com/graphql
RATE_LIMIT_MAX=60
RATE_LIMIT_ENQUIRY_MAX=10
LOG_LEVEL=info
```

**Never commit `.env` to git.**

## 5. Docker Services (Postgres + Redis)

```bash
# Edit docker-compose.prod.yml with strong passwords
docker compose -f docker-compose.prod.yml up -d postgres redis
```

Or use managed DB/Redis from your cloud provider and point `DATABASE_URL` / `REDIS_URL` accordingly.

## 6. Build and Migrate

```bash
npm ci --omit=dev
npm run build
npx prisma migrate deploy
```

## 7. PM2 Process Management

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command PM2 prints, then:
pm2 save
```

Verify:

```bash
pm2 list
pm2 logs property-api --lines 50
curl http://127.0.0.1:3000/health
```

## 8. Nginx Reverse Proxy

```bash
sudo cp nginx/property-platform.conf /etc/nginx/sites-available/property-platform
sudo ln -s /etc/nginx/sites-available/property-platform /etc/nginx/sites-enabled/
sudo nginx -t
```

Replace `your-domain.com` in the config with your actual domain.

## 9. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo systemctl reload nginx
```

Auto-renewal is configured by certbot. Test with:

```bash
sudo certbot renew --dry-run
```

## 10. Logging Strategy

| Component | Location |
|-----------|----------|
| API (PM2) | `./logs/api-out.log`, `./logs/api-error.log` |
| Worker (PM2) | `./logs/worker-out.log`, `./logs/worker-error.log` |
| Nginx | `/var/log/nginx/property-platform.*.log` |
| Docker Postgres | `docker logs property-postgres` |

Log rotation: configure `logrotate` for PM2 logs on production.

## 11. Health Checks

- Application: `GET /health` (returns DB + Redis status)
- Docker: `HEALTHCHECK` in Dockerfile
- Nginx: dedicated `/health` location (no rate limit)
- External: UptimeRobot / Pingdom on `https://your-domain.com/health`

## 12. Deployment Updates

```bash
cd /home/deploy/property-platform-backend
git pull origin main
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 reload ecosystem.config.js
```

## 13. Screenshots for Submission

Capture and save to `screenshots/`:

1. `curl https://your-domain.com/health` response
2. `pm2 list` output
3. `docker ps` output
4. Browser showing HTTPS padlock on your domain
5. Snippet of Nginx SSL config

## Rollback

```bash
git checkout <previous-commit>
npm ci --omit=dev && npm run build
npx prisma migrate deploy
pm2 reload ecosystem.config.js
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | Check `pm2 list`, ensure API listens on 3000 |
| DB connection refused | Verify Docker postgres is running, check `DATABASE_URL` |
| Redis errors | Check Redis password in URL matches docker-compose |
| Webhook 401 | Regenerate signature with production `CRM_WEBHOOK_SECRET` |
