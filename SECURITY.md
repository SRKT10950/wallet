# Security Architecture & Device Authentication: My Wallet

**My Wallet** implements a defense-in-depth security model specifically tailored for multi-terminal shop environments.

---

## 1. Core Security Principles

1. **Zero Database Exposure**: Android and PWA clients are never permitted to communicate directly with PostgreSQL or Redis. All operations traverse the authenticated REST API.
2. **Untrusted Client Inputs**: Financial calculations (subtotals, discounts, sales taxes, grand totals, balance due) calculated on client devices are completely untrusted. The backend recomputes all monetary calculations using integer minor units or fixed decimals before writing to the database.
3. **Mutual Device Security Handshake**: Valid user credentials alone are insufficient. Requests must originate from an enrolled terminal possessing an active device security key and a valid application API key.
4. **Immediate Revocation**: A revoked terminal loses API access instantaneously across all endpoints.
5. **No Invasive Fingerprinting**: In compliance with modern privacy and mobile operating system sandboxes, no invasive hardware serials or MAC addresses are harvested. PWA clients generate installation IDs, and Android devices utilize standard model names and Android Keystore protection.

---

## 2. API Header Security Contract

Every protected HTTP request to `/api/v1/*` must present the following headers:

```http
X-API-Key: <APPLICATION_API_KEY>
X-Device-Security-Key: <DEVICE_SECURITY_KEY>
X-Device-Name: <REGISTERED_DEVICE_NAME>
X-Device-Type: Mobile | Desktop | Server | IoT
X-App-Name: My Wallet
X-Location: <LOCATION_UUID>
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Verification Pipeline:
```
Request Incoming
    ↓
Nginx validates IP & passes X-Real-IP
    ↓
API Key Validation (Hash matches active application in api_keys)
    ↓
Device Key Validation (SHA-256 hash matches active terminal in devices)
    ↓
Device Status Check (Rejects PENDING, SUSPENDED, REVOKED with 403)
    ↓
Location Verification (Ensures device is permitted for X-Location)
    ↓
IP Allowlist Verification (If configured on device)
    ↓
User Authentication & RBAC Permission Check
    ↓
Audit Trail Appended (audit_logs)
```

---

## 3. Device Lifecycle

A terminal exists in one of four states:
- `PENDING`: Device record created but requires administrator approval before executing transactions.
- `ACTIVE`: Fully authenticated device with operational privileges.
- `SUSPENDED`: Temporarily deactivated by an administrator. API calls return `403 DEVICE_SUSPENDED`.
- `REVOKED`: Permanently decommissioned. All active sessions tied to the device are killed. Subsequent calls return `403 DEVICE_REVOKED`.

### Device Registration & Enrollment Flow:
1. Client requests enrollment via `POST /api/v1/devices/register` with its application API key.
2. Server generates a random 384-bit (48-byte) secret `deviceSecurityKey` and a unique installation identifier.
3. The server computes the SHA-256 hash of the `deviceSecurityKey` and stores only the hash in the `devices` table.
4. The plaintext `deviceSecurityKey` is transmitted **exactly once** in the response.
5. The Android client securely commits the key to the **Android Keystore**, while the PWA stores it in local encrypted browser storage.

---

## 4. User Authentication & Session Security

- **Password Hashing**: Uses modern **Argon2id** (`@node-rs/argon2`) with high memory and time cost factors, with scrypt fallback. Plaintext passwords are never logged or stored.
- **Short-Lived Access Tokens**: Signed JWT access tokens with a 15-minute expiration period.
- **Token Rotation**: Every call to `POST /api/v1/auth/refresh` immediately revokes the existing refresh token and issues a newly generated random refresh token.
- **Lockout Protection**: Accounts are automatically locked for 15 minutes after 5 consecutive failed login attempts.

---

## 5. Network Security & Reverse Proxy

- All incoming traffic in production is routed through Nginx.
- Client IP addresses are resolved using trusted proxy CIDRs configured in `TRUSTED_PROXY_IPS`. Direct connections without a trusted reverse proxy cannot spoof `X-Forwarded-For`.
- The PostgreSQL and Redis ports (5432, 6379) are isolated inside the internal Docker bridge network and never published to the public internet.
