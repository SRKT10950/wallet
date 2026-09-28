# Linux Server & Docker Deployment Guide: My Wallet

This document describes how to deploy **My Wallet** on a Linux server (Ubuntu/Debian/RHEL) using Docker and Docker Compose.

---

## 1. Prerequisites

- Linux Server with Ubuntu 22.04 LTS or newer
- Docker Engine v24.0+ and Docker Compose v2.20+
- A valid domain name pointing to the server's public IP
- Port 80 and 443 open on firewall / security groups

---

## 2. Directory Structure on Server

Clone the repository to `/opt/my-wallet`:

```bash
cd /opt
git clone <repository_url> my-wallet
cd my-wallet
```

---

## 3. Environment Configuration

Copy the sample environment file to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with strong production secrets:

```env
NODE_ENV=production
PORT=3000
APP_NAME=My Wallet
APP_VERSION=1.0.0

# Database
DATABASE_HOST=my-wallet-db
DATABASE_PORT=5432
DATABASE_NAME=wallet
DATABASE_USER=wallet_prod_user
DATABASE_PASSWORD=GENERATE_STRONG_RANDOM_PASSWORD_64_CHARS

# Redis
REDIS_PASSWORD=GENERATE_STRONG_REDIS_PASSWORD_64_CHARS

# JWT Secrets
JWT_SECRET=GENERATE_STRONG_JWT_SECRET_AT_LEAST_64_CHARS
JWT_REFRESH_SECRET=GENERATE_STRONG_REFRESH_SECRET_AT_LEAST_64_CHARS

# Reverse Proxy Security
TRUSTED_PROXY_IPS=127.0.0.1,172.16.0.0/12,my-wallet-nginx

# Domain & CORS
CORS_ALLOWED_ORIGINS=https://wallet.yourdomain.com
```

---

## 4. Production Build & Deployment

Execute the production stack:

```bash
# Build and launch production containers in detached mode
docker compose -f docker-compose.prod.yml up -d --build

# Run initial migrations on the production database
docker exec -it my-wallet-api-prod npm run migration:run

# Seed baseline roles, admin user, and initial application keys
docker exec -it my-wallet-api-prod npm run seed:run
```

---

## 5. SSL / TLS Certificate Setup

To obtain a Let's Encrypt certificate:

```bash
apt-get install -y certbot

certbot certonly --standalone -d wallet.yourdomain.com
```

Link the certificates to the Nginx volume:

```bash
mkdir -p docker/nginx/certs
cp /etc/letsencrypt/live/wallet.yourdomain.com/fullchain.pem docker/nginx/certs/fullchain.pem
cp /etc/letsencrypt/live/wallet.yourdomain.com/privkey.pem docker/nginx/certs/privkey.pem
```

---

## 6. Health & Liveness Probes

The API exposes a health endpoint:

```bash
curl -i http://localhost:3000/health
```

Expected output:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-28T07:30:00.000Z",
  "service": "My Wallet",
  "version": "1.0.0",
  "database": "connected"
}
```

Docker Compose automatically probes this health status every 15 seconds.

---

## 7. Container Maintenance & Log Rotation

To view real-time logs across all services:

```bash
docker compose -f docker-compose.prod.yml logs -f my-wallet-api
```

To update to a new release without data loss:

```bash
git pull origin main
docker compose -f docker-compose.prod.yml build my-wallet-api
docker compose -f docker-compose.prod.yml up -d --no-deps my-wallet-api
docker exec -it my-wallet-api-prod npm run migration:run
```
