# Coolify Deployment Guide: My Wallet

**Target Domain**: `https://wallet.mhservice.co.in`

This guide explains how to deploy **My Wallet** to **Coolify** (v4) with automated Let's Encrypt SSL, multi-service Docker Compose orchestration, and automated database bootstrapping.

---

## 1. Step 1: DNS Configuration

Before deploying in Coolify, point your subdomain DNS record to your Coolify VPS server:

| Type | Name / Host | Target / Value | TTL | Proxy Status |
|---|---|---|---|---|
| **A** | `wallet` (or `wallet.mhservice.co.in`) | `<YOUR_COOLIFY_SERVER_PUBLIC_IP>` | Auto / 300 | DNS Only (Disable Cloudflare orange cloud proxy initially for ACME SSL challenge) |

Verify the DNS propagation via terminal:
```bash
ping wallet.mhservice.co.in
```

---

## 2. Step 2: Push Source Code to Git

Initialize and push the repository to GitHub, GitLab, or Gitea:

```bash
# In project root: d:/Real Project/My Wallet
git init
git add .
git commit -m "feat: complete My Wallet business management system ready for Coolify"
git branch -M main
git remote add origin https://github.com/<your-username>/my-wallet.git
git push -u origin main
```

---

## 3. Step 3: Deploy in Coolify Dashboard

### 3.1 Create Application
1. Open your **Coolify Dashboard** (e.g. `http://<server-ip>:8000`).
2. Go to **Projects** -> Select your Project (or create a new one, e.g. `Business Apps`).
3. Click **+ New** -> **Application** -> **Public / Private Git Repository**.
4. Paste your Git repository URL: `https://github.com/<your-username>/my-wallet`.
5. Select branch: `main`.

### 3.2 Configure Build Pack
1. Under **Build Pack**, select: **Docker Compose**.
2. Set **Docker Compose Location**:
   ```
   /docker-compose.coolify.yml
   ```

### 3.3 Set Domains
1. In the **Domains** field, enter:
   ```
   https://wallet.mhservice.co.in
   ```
   *(Coolify's Traefik will automatically provision a valid Let's Encrypt SSL certificate).*

### 3.4 Environment Variables (Optional Customization)
Coolify can automatically use the defaults in `docker-compose.coolify.yml`, or you can override them under the **Environment Variables** tab:

```env
NODE_ENV=production
DATABASE_NAME=wallet
DATABASE_USER=wallet_app
DATABASE_PASSWORD=CHANGE_TO_A_SECURE_RANDOM_PASSWORD
JWT_SECRET=GENERATE_RANDOM_STRING_AT_LEAST_32_CHARACTERS
JWT_REFRESH_SECRET=GENERATE_RANDOM_STRING_AT_LEAST_32_CHARACTERS
TRUSTED_PROXY_IPS=127.0.0.1,172.16.0.0/12,my-wallet-nginx,traefik
CORS_ALLOWED_ORIGINS=https://wallet.mhservice.co.in
```

### 3.5 Click Deploy
Click **Deploy**!
Coolify will:
1. Clone the repository.
2. Build the multi-stage Nginx container (compiling the React PWA into production static assets).
3. Build the Node.js API container.
4. Launch PostgreSQL 16 (`my-wallet-db`) and Redis 7 (`my-wallet-redis`).
5. Wait for the database to become healthy.
6. The API container automatically runs migrations and seeds baseline data on startup.
7. Traefik automatically routes `https://wallet.mhservice.co.in` to port 80 with HTTPS.

---

## 4. Alternative Method: Raw Docker Compose in Coolify

If you prefer to deploy directly without connecting a Git provider:

1. In Coolify, click **+ New** -> **Docker Compose**.
2. Copy and paste the entire contents of [`docker-compose.coolify.yml`](file:///d:/Real%20Project/My%20Wallet/docker-compose.coolify.yml).
3. Set the domain to: `https://wallet.mhservice.co.in`.
4. Click **Deploy**.

---

## 5. Post-Deployment Verification

### 5.1 Access Web App
Open your browser and navigate to:
```
https://wallet.mhservice.co.in
```

### 5.2 Initial Sign-In
Use the seeded master administrator credentials:
- **Email**: `admin@mywallet.local`
- **Password**: `AdminWallet@2026!`

The PWA will detect the terminal installation and authenticate over HTTPS.

### 5.3 Health Check Verification
Verify the backend status directly:
```
https://wallet.mhservice.co.in/health
```
Expected output:
```json
{
  "status": "healthy",
  "service": "My Wallet",
  "version": "1.0.0",
  "database": "connected"
}
```

---

## 6. Connecting Android App to Deployed Coolify Server

In the Android mobile client (`mobile/lib/core/api_client.dart`):

Change the `baseUrl` to your deployed Coolify domain:
```dart
static String baseUrl = 'https://wallet.mhservice.co.in/api/v1';
```

Then build the Android APK:
```bash
cd mobile
flutter build apk --release
```
The APK located at `mobile/build/app/outputs/flutter-apk/app-release.apk` can be installed on Android devices, and will connect securely over HTTPS to `https://wallet.mhservice.co.in`.
