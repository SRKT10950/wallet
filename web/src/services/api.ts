import { getStoredDeviceCredentials } from './deviceIdentity';
import { OfflineQueue } from './offlineQueue';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; meta?: any }> {
  const creds = getStoredDeviceCredentials();
  const token = localStorage.getItem('my_wallet_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attach Security & Device Headers if available
  if (creds?.apiKey) {
    headers['X-API-Key'] = creds.apiKey;
  }
  if (creds?.deviceSecurityKey) {
    headers['X-Device-Security-Key'] = creds.deviceSecurityKey;
  }
  if (creds?.deviceName) {
    headers['X-Device-Name'] = creds.deviceName;
  }
  if (creds?.deviceType) {
    headers['X-Device-Type'] = creds.deviceType;
  }
  headers['X-App-Name'] = creds?.appName || 'My Wallet';
  if (creds?.locationId) {
    headers['X-Location'] = creds.locationId;
  }

  // Attach Authorization
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle Blob/PDF responses
    if (res.headers.get('content-type')?.includes('application/pdf')) {
      const blob = await res.blob();
      return { success: true, data: blob as any };
    }

    const json = await res.json();

    if (!res.ok || json.success === false) {
      const err = json?.error || { message: 'Network request failed', code: 'REQUEST_FAILED' };
      throw new ApiError(err.message, err.code, err.details);
    }

    return json;
  } catch (error: any) {
    // Check if network is offline
    if (!navigator.onLine || error.name === 'TypeError') {
      console.warn('[OFFLINE] Request failed due to network disconnect:', endpoint);
      throw new ApiError('You appear to be offline. Network connection lost.', 'OFFLINE');
    }
    throw error;
  }
}

// API Service Functions
export const api = {
  // Device & Auth
  registerDevice: (input: any) => request('/devices/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (credentials: { identifier: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),
  getDashboardCharts: (days: number = 14) => request(`/dashboard/charts?days=${days}`),

  // Invoices
  getInvoices: (params: string = '') => request(`/invoices${params ? `?${params}` : ''}`),
  getInvoiceById: (id: string) => request(`/invoices/${id}`),
  createInvoice: async (payload: any) => {
    try {
      return await request('/invoices', { method: 'POST', body: JSON.stringify(payload) });
    } catch (err: any) {
      if (err.code === 'OFFLINE') {
        const item = await OfflineQueue.enqueue('INVOICE', payload);
        return {
          success: true,
          data: {
            ...payload,
            id: item.id,
            invoice_number: 'PENDING-OFFLINE',
            payment_status: 'PENDING_SYNC',
            grand_total: payload.items?.reduce((acc: number, i: any) => acc + (i.quantity * i.unitPrice), 0) || 0,
            _isOffline: true,
          } as any,
        };
      }
      throw err;
    }
  },
  cancelInvoice: (id: string, reason?: string) =>
    request(`/invoices/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  downloadInvoicePdf: (id: string) => request<Blob>(`/invoices/${id}/pdf`),

  // Expenses
  getExpenses: (params: string = '') => request(`/expenses${params ? `?${params}` : ''}`),
  getExpenseSummary: (period: 'daily' | 'weekly' | 'monthly' = 'daily') => request(`/expenses/summary?period=${period}`),
  getExpenseCategories: () => request('/expenses/categories'),
  createExpense: async (payload: any) => {
    try {
      return await request('/expenses', { method: 'POST', body: JSON.stringify(payload) });
    } catch (err: any) {
      if (err.code === 'OFFLINE') {
        const item = await OfflineQueue.enqueue('EXPENSE', payload);
        return {
          success: true,
          data: {
            ...payload,
            id: item.id,
            category_name: 'Pending Sync',
            _isOffline: true,
          } as any,
        };
      }
      throw err;
    }
  },
  deleteExpense: (id: string) => request(`/expenses/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: (params: string = '') => request(`/customers${params ? `?${params}` : ''}`),
  createCustomer: (payload: any) => request('/customers', { method: 'POST', body: JSON.stringify(payload) }),

  // Products
  getProducts: (params: string = '') => request(`/products${params ? `?${params}` : ''}`),
  createProduct: (payload: any) => request('/products', { method: 'POST', body: JSON.stringify(payload) }),

  // Devices (Admin)
  getDevices: () => request('/devices'),
  revokeDevice: (id: string) => request(`/devices/${id}/revoke`, { method: 'POST' }),
  suspendDevice: (id: string) => request(`/devices/${id}/suspend`, { method: 'POST' }),
  activateDevice: (id: string) => request(`/devices/${id}/activate`, { method: 'POST' }),

  // Reports
  getSalesReport: (startDate?: string, endDate?: string) =>
    request(`/reports/sales?${new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' }).toString()}`),
  getProfitLossReport: (startDate?: string, endDate?: string) =>
    request(`/reports/profit-loss?${new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' }).toString()}`),
};
