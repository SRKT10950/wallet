import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Invoice } from '../types';
import {
  Plus,
  Search,
  FileText,
  Download,
  Ban,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

interface InvoicesPageProps {
  showCreateModal: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  showCreateModal,
  onCloseCreateModal,
  onOpenCreateModal,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Invoice creation state
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<any[]>([
    { itemName: 'Retail Item', quantity: 1, unitPrice: 10, discountRate: 0, taxRate: 5 },
  ]);
  const [initialPaid, setInitialPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('paymentStatus', statusFilter);
      const res = await api.getInvoices(params.toString());
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    api.getCustomers().then((res) => setCustomers(res.data || [])).catch(() => {});
  }, [statusFilter]);

  const handleAddItem = () => {
    setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, discountRate: 0, taxRate: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Live Calculations
  const calculatedSubtotal = items.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const calculatedTax = items.reduce((acc, i) => {
    const raw = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    const disc = (raw * (Number(i.discountRate) || 0)) / 100;
    return acc + ((raw - disc) * (Number(i.taxRate) || 0)) / 100;
  }, 0);
  const calculatedDiscount = items.reduce((acc, i) => {
    const raw = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    return acc + (raw * (Number(i.discountRate) || 0)) / 100;
  }, 0);
  const calculatedTotal = calculatedSubtotal - calculatedDiscount + calculatedTax;
  const calculatedBalance = Math.max(0, calculatedTotal - Number(initialPaid || 0));

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createInvoice({
        customerId: selectedCustomerId || undefined,
        items,
        initialAmountPaid: Number(initialPaid),
        paymentMethod,
      });
      onCloseCreateModal();
      fetchInvoices();
      // Reset form
      setItems([{ itemName: 'Retail Item', quantity: 1, unitPrice: 10, discountRate: 0, taxRate: 5 }]);
      setInitialPaid(0);
    } catch (err: any) {
      alert(err.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
    try {
      setDownloadingId(id);
      const res = await api.downloadInvoicePdf(id);
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancelInvoice = async (id: string) => {
    const reason = prompt('Please enter a cancellation reason:');
    if (reason === null) return;
    try {
      await api.cancelInvoice(id, reason);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invoice');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">PAID</span>;
      case 'PARTIALLY_PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">PARTIAL</span>;
      case 'UNPAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">UNPAID</span>;
      case 'PENDING_SYNC':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">PENDING SYNC</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 line-through">CANCELLED</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices & Billing</h1>
          <p className="text-xs text-slate-500">Create, manage, and print sales invoices</p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No invoices found. Click "Create Invoice" to begin.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(inv.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {inv.customer_name || 'Walk-in Customer'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ${Number(inv.grand_total).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-rose-600">
                      ${Number(inv.balance_due).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {statusBadge(inv.payment_status)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                        disabled={downloadingId === inv.id}
                        className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 transition inline-flex items-center"
                        title="Download PDF"
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      {!inv.is_cancelled && (
                        <button
                          onClick={() => handleCancelInvoice(inv.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition inline-flex items-center"
                          title="Cancel Invoice"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Create Sales Invoice</h2>
              <button onClick={onCloseCreateModal} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Walk-in Customer (No account)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-16 px-2 py-1.5 text-xs border border-slate-300 rounded text-right focus:outline-none"
                        min="0.01"
                        step="any"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded text-right focus:outline-none"
                        min="0"
                        step="0.01"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Tax %"
                        value={item.taxRate}
                        onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                        className="w-16 px-2 py-1.5 text-xs border border-slate-300 rounded text-right focus:outline-none"
                        min="0"
                        step="0.1"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${calculatedSubtotal.toFixed(2)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-${calculatedDiscount.toFixed(2)}</span>
                  </div>
                )}
                {calculatedTax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax:</span>
                    <span>+${calculatedTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>${calculatedTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Amount Paid
                  </label>
                  <input
                    type="number"
                    value={initialPaid}
                    onChange={(e) => setInitialPaid(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    min="0"
                    max={calculatedTotal}
                    step="0.01"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Balance Due: <span className="font-semibold text-rose-600">${calculatedBalance.toFixed(2)}</span>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit/Debit Card</option>
                    <option value="UPI">UPI / Digital</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onCloseCreateModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save & Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
