# My Wallet - Business Management System

A production-ready business management application for shopkeepers and small enterprises, featuring mutual device security, multi-terminal enrollment, immutable audit logging, and offline synchronization.

---

## 1. System Overview

- **Android Application**: Flutter-based mobile client using official Android APIs for hardware identification and **Android Keystore** for secure credential encryption.
- **Progressive Web App (PWA)**: React 18 + Vite + Tailwind CSS with Service Worker caching and an IndexedDB offline write queue distinguishing "Saved to server", "Pending synchronization", and "Failed".
- **REST API Backend**: Node.js 24 + TypeScript with Express, Zod validation, and Knex PostgreSQL database migration engine.
- **Database**: PostgreSQL 16 (`wallet`) with `NUMERIC(18,2)` monetary precision, foreign key constraints, and database-level triggers enforcing immutable audit logs.
- **Infrastructure**: Linux + Docker Compose architecture with Nginx reverse proxy, PostgreSQL, and Redis.

---

## 2. Default Seed Credentials & API Keys

After running the database seeder (`npm run seed:run`), the following credentials are initialized:

- **Master Administrator**:
  - Email: `admin@mywallet.local`
  - Password: `AdminWallet@2026!`
  - Role: `OWNER` (full privileges)
- **Application API Keys**:
  - Android App: `mw_live_android_app_key_secure_2026`
  - Web PWA: `mw_live_pwa_web_app_key_secure_2026`

---

## 3. Quickstart (Local Development)

### 3.1 Start Database & Cache
```bash
docker compose up -d my-wallet-db my-wallet-redis
```

### 3.2 Initialize Backend API
```bash
cd backend
npm install
npm run migration:run
npm run seed:run
npm run dev
```
Backend API will start at: `http://localhost:3000/api/v1`
Health probe: `http://localhost:3000/health`

### 3.3 Start Progressive Web App (PWA)
```bash
cd web
npm install
npm run dev
```
PWA will open at: `http://localhost:5173`

### 3.4 Launch Android App (Flutter)
```bash
cd mobile
flutter pub get
flutter run
```

---

## 4. Running Automated Tests

```bash
cd backend
npm test
```
Runs the Vitest test suite testing:
- Minor unit integer financial conversions & rounding
- Line tax and discount calculation engine
- Argon2id / scrypt password hashing & API key fingerprints
- Device security header validation & 401/403 rejection logic

---

## 5. Repository Structure

```
my-wallet/
├── backend/                  # Node.js 24 + TypeScript REST API
│   ├── src/
│   │   ├── config/           # Environment configuration & Zod schema
│   │   ├── database/         # Migrations (20+ tables) & baseline seeders
│   │   ├── middlewares/      # Device security, Auth JWT, RBAC guard, Error handler
│   │   ├── modules/          # Invoices, Expenses, Payments, Customers, Products, Reports, Audit
│   │   └── utils/            # Argon2 crypto & exact money math utilities
│   ├── tests/                # Automated Vitest test suite
│   └── Dockerfile
│
├── web/                      # Progressive Web App (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/       # Header, Sidebar, MetricCard, DeviceSetupModal
│   │   ├── context/          # Auth & offline sync state management
│   │   ├── pages/            # Dashboard, Invoices, Expenses, Customers, Devices, Reports, Audit
│   │   └── services/         # API client & IndexedDB sync queue
│   ├── public/               # PWA Manifest & App Icons
│   └── Dockerfile
│
├── mobile/                   # Android Application (Flutter Native)
│   ├── lib/
│   │   ├── core/             # Device identity, Keystore secure storage, API client
│   │   ├── models/           # Invoice, Expense, Customer models
│   │   └── screens/          # Login, Dashboard, Invoices, Expenses, Customers, Terminal Info
│   ├── android/              # Native Android configuration & Manifest
│   └── pubspec.yaml
│
├── docker/
│   ├── nginx/                # Reverse proxy, SSL, Security headers
│   └── postgres/             # Database initialization script
│
├── docker-compose.yml        # Development environment
├── docker-compose.prod.yml   # Hardened production stack
├── .env.example              # Configuration template
├── API.md                    # REST API documentation
├── SECURITY.md               # Device security & authentication guide
├── DEPLOYMENT.md             # Linux production deployment manual
└── DATABASE.md               # Schema reference & backup/restore strategy
```

---

## 6. Complete Documentation

- [API.md](file:///d:/Real%20Project/My%20Wallet/API.md) - Complete REST endpoints reference.
- [SECURITY.md](file:///d:/Real%20Project/My%20Wallet/SECURITY.md) - Device authentication & mutual handshake protocol.
- [DATABASE.md](file:///d:/Real%20Project/My%20Wallet/DATABASE.md) - Database schema, migrations, and backup/restore guide.
- [DEPLOYMENT.md](file:///d:/Real%20Project/My%20Wallet/DEPLOYMENT.md) - Linux + Docker server deployment guide.
