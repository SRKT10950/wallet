export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface DeviceCredentials {
  apiKey: string;
  deviceSecurityKey: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'Desktop' | 'Mobile';
  locationId: string;
  appName: string;
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface Business {
  id: string;
  name: string;
  currency: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
}

export interface InvoiceItem {
  id?: string;
  productId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  lineSubtotal: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  grand_total: number | string;
  amount_paid: number | string;
  balance_due: number | string;
  currency: string;
  is_cancelled: boolean;
  notes?: string;
  items?: InvoiceItem[];
  created_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  amount: number | string;
  currency: string;
  category_name: string;
  description: string;
  payment_method: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  outstanding_balance: number | string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  cost_price: number | string;
  selling_price: number | string;
  tax_rate: number | string;
  unit: string;
  stock_quantity: number | string;
  category_name?: string;
}

export interface DeviceRecord {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  status: DeviceStatus;
  last_seen_at?: string;
  last_seen_ip?: string;
  location_name: string;
  enrolled_at: string;
}

export interface SyncItem {
  id: string;
  type: 'INVOICE' | 'EXPENSE' | 'PAYMENT';
  payload: any;
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  createdAt: number;
  errorMessage?: string;
}
