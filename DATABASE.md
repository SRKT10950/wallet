# Database Architecture & Management: My Wallet

This document defines the schema, migrations, transactions, immutability guarantees, and disaster recovery procedures for the **My Wallet** relational database (`wallet`) running on **PostgreSQL 16**.

---

## 1. Database Overview & Principles

- **Database Name**: `wallet`
- **Engine**: PostgreSQL 16 (Alpine Docker Container)
- **Primary Keys**: UUID v4 (`uuid-ossp` / `pgcrypto`)
- **Monetary Precision**: Strictly `NUMERIC(18,2)`. Floating point types (`REAL`, `FLOAT`, `DOUBLE PRECISION`) are prohibited.
- **Audit Logging**: Append-only via PostgreSQL trigger `trigger_immutable_audit_logs`. `UPDATE` and `DELETE` operations are rejected at the database engine level.
- **Concurrency Control**: Row-level locking (`FOR UPDATE`) is used when allocating invoice numbers (`INV-YYYYMM-XXXX`) to guarantee zero sequence collisions under heavy concurrent traffic.

---

## 2. Table Catalog

| Table Name | Primary Purpose | Immutability / Constraints |
|---|---|---|
| `businesses` | Tenant shop / enterprise entity | Unique `name` |
| `locations` | Branch / shop counter physical locations | Foreign key to `businesses`, code uniqueness |
| `users` | Store owners, admins, managers, and staff | Unique `email`, argon2id password hash |
| `roles` | System authorization roles (OWNER, ADMIN, etc.) | Unique `name` |
| `permissions` | Granular permission catalog | Unique `name` |
| `user_roles` | Many-to-many user to role assignment | Composite primary key `(user_id, role_id)` |
| `role_permissions` | Permissions granted to roles | Composite primary key `(role_id, permission_id)` |
| `applications` | Registered client platforms (Android, PWA) | Unique `app_identifier` |
| `api_keys` | Cryptographic application access credentials | SHA-256 `key_hash`, prefix, revoked_at |
| `devices` | Registered hardware/installations | Enrolled key hash, status (ACTIVE, REVOKED) |
| `customers` | Client directory & outstanding balance | Indexed on phone, name |
| `suppliers` | Wholesale vendors and purchase sources | Balance tracking |
| `product_categories` | Catalog taxonomy | Unique per business |
| `products` | Inventory items, selling/cost prices, tax rates | SKU and barcode indexes |
| `purchase_records` | Supplier purchase logs | Unique purchase number |
| `invoices` | Sales bills & totals | `NUMERIC(18,2)`, unique invoice number |
| `invoice_items` | Individual line items with tax/discounts | Cascade delete on draft invoice |
| `payments` | Customer and invoice payment records | Transactional balance updates |
| `expense_categories` | Categorization for business expenses | Configurable heads (Rent, Electricity, etc.) |
| `expenses` | Daily operational expenditure entries | Indexed by date, category, location |
| `audit_logs` | Immutable audit trail | **IMMUTABLE**: Triggers prevent updates/deletions |
| `sessions` | Active user login sessions | Automatic expiry index |
| `refresh_tokens` | Rotating JWT refresh tokens | Token rotation & revocation tracking |
| `settings` | Key-value store for business configs | JSONB storage |

---

## 3. Database Migrations

The project provides a deterministic migration system built on Knex.

### Available Commands:
```bash
# Apply pending migrations
npm run migration:run

# Rollback last migration batch
npm run migration:rollback

# Create a new migration file
npm run migration:create add_customer_loyalty_points

# Seed baseline database with system roles, admin, and default app
npm run seed:run
```

---

## 4. Immutable Audit Log Trigger

The following PostgreSQL function and trigger are installed during migration `002_create_devices_and_api_keys.ts` to ensure that audit records can never be altered or tampered with:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

---

## 5. PostgreSQL Backup & Disaster Recovery Strategy

> [!IMPORTANT]
> A backup is not considered valid unless the operation executes with exit code 0 and is verified by a test restore.

### 5.1 Automated Daily Backup Script (`docker/postgres/backup.sh`)
```bash
#!/bin/bash
set -eo pipefail

BACKUP_DIR="/var/backups/mywallet"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/wallet_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL backup for 'wallet'..."

# Execute pg_dump inside container with gzip compression
docker exec -t my-wallet-db pg_dump -U wallet_app -d wallet --clean --if-exists | gzip > "${BACKUP_FILE}"

# Verify file size is greater than 1KB
if [ $(stat -c%s "${BACKUP_FILE}") -lt 1024 ]; then
  echo "[ERROR] Backup file is suspiciously small or empty!"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

echo "[SUCCESS] Backup written to ${BACKUP_FILE}"

# Optional: GPG Encryption
# gpg --encrypt --recipient ops@mywallet.local "${BACKUP_FILE}"

# Retention Policy: Prune backups older than 30 days
find "${BACKUP_DIR}" -type f -name "wallet_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[CLEANUP] Backups older than ${RETENTION_DAYS} days removed."
```

### 5.2 Restore Procedure
To restore the `wallet` database from an existing compressed archive:

1. **Stop active API services** to prevent concurrent writes:
   ```bash
   docker compose stop my-wallet-api
   ```
2. **Execute restore via `pg_restore` or `psql`**:
   ```bash
   gunzip -c /var/backups/mywallet/wallet_YYYYMMDD_HHMMSS.sql.gz | docker exec -i my-wallet-db psql -U wallet_app -d wallet
   ```
3. **Verify database connectivity and counts**:
   ```bash
   docker exec -it my-wallet-db psql -U wallet_app -d wallet -c "SELECT COUNT(*) FROM invoices;"
   ```
4. **Restart API service**:
   ```bash
   docker compose start my-wallet-api
   ```
