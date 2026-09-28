# REST API Reference: My Wallet

Base URL: `/api/v1`

All responses follow a standard envelope:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "requestId": "req_63bf8e27c19a4b3d"
}
```

### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DEVICE_REVOKED",
    "message": "This device is no longer authorized.",
    "details": null
  },
  "requestId": "req_63bf8e27c19a4b3d"
}
```

---

## 1. Authentication (`/auth`)

### `POST /auth/login`
Authenticates a user and establishes a session. Requires device headers.

**Request Body**:
```json
{
  "identifier": "admin@mywallet.local",
  "password": "AdminWallet@2026!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@mywallet.local",
      "fullName": "Master Administrator",
      "roles": ["OWNER"],
      "permissions": ["invoice:create", "invoice:read", ...]
    },
    "business": {
      "id": "uuid",
      "name": "My Wallet Store",
      "currency": "USD"
    },
    "location": {
      "id": "uuid",
      "name": "Main Branch"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "random_token_48_bytes",
      "expiresIn": "15m"
    }
  }
}
```

### `POST /auth/refresh`
Rotates the refresh token and returns a new access token.

### `POST /auth/logout`
Revokes active refresh tokens and ends session.

### `GET /auth/me`
Fetches authenticated user, assigned roles, permissions, and active device info.

---

## 2. Devices (`/devices`)

### `POST /devices/register`
Enrolls a new terminal. Requires `X-API-Key` header.

**Request Body**:
```json
{
  "deviceName": "Counter 1 Android Tablet",
  "deviceType": "Mobile",
  "locationId": "optional-location-uuid",
  "osVersion": "Android 14 (API 34)",
  "appVersion": "1.0.0"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deviceId": "dev_4b89f2...",
    "deviceName": "Counter 1 Android Tablet",
    "deviceType": "Mobile",
    "status": "ACTIVE",
    "deviceSecurityKey": "384_bit_random_hex_key_STORE_IMMEDIATELY",
    "enrolledAt": "2026-09-28T07:00:00.000Z"
  }
}
```

### `GET /devices`
Lists all registered devices. Requires `devices:manage` permission.

### `POST /devices/:id/revoke`
Immediately revokes device access. All further requests from this terminal will be denied with `403 DEVICE_REVOKED`.

### `POST /devices/:id/suspend`
Temporarily suspends a device.

### `POST /devices/:id/activate`
Activates or re-enables a device.

---

## 3. Invoices (`/invoices`)

### `GET /invoices`
Lists invoices with filtering and pagination.
- Query parameters: `page`, `limit`, `search`, `paymentStatus`, `customerId`, `startDate`, `endDate`.

### `POST /invoices`
Creates a sales invoice. Backend recalculates subtotal, discounts, taxes, and balance due.

**Request Body**:
```json
{
  "customerId": "optional-uuid",
  "invoiceDate": "2026-09-28",
  "items": [
    {
      "productId": "optional-uuid",
      "itemName": "Premium Roast Coffee 500g",
      "quantity": 2,
      "unitPrice": 15.00,
      "discountRate": 5,
      "taxRate": 5
    }
  ],
  "initialAmountPaid": 20.00,
  "paymentMethod": "CASH"
}
```

### `GET /invoices/:id`
Retrieves invoice details, line items, and settlement payment history.

### `POST /invoices/:id/cancel`
Cancels an invoice, reverses customer balances, and restocks inventory.

### `GET /invoices/:id/pdf`
Streams generated professional PDF invoice.

---

## 4. Expenses (`/expenses`)

### `GET /expenses`
Lists expenses with filtering by category and date.

### `POST /expenses`
Records a business expense.

**Request Body**:
```json
{
  "categoryId": "category-uuid",
  "amount": 140.50,
  "description": "Monthly Internet Broadband Bill",
  "paymentMethod": "BANK_TRANSFER"
}
```

### `GET /expenses/summary?period=daily|weekly|monthly`
Aggregated expense metrics and category breakdowns.

---

## 5. Dashboard & Reports (`/dashboard`, `/reports`)

### `GET /dashboard/summary`
Returns today's sales, expenses, estimated profit, and outstanding receivables.

### `GET /dashboard/charts?days=14`
Returns 14-day sales vs expenses comparison series, category breakdown, and payment status distribution.

### `GET /reports/sales`
Detailed sales billing report.

### `GET /reports/profit-loss`
All-time and periodic Profit & Loss statement.

---

## 6. Audit Trail (`/audit-logs`)

### `GET /audit-logs`
Returns the append-only immutable audit trail with filters: `action`, `resourceType`, `userId`, `deviceId`.
