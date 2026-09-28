import { db } from '../../database/index.js';

export class ReportsService {
  public static async getSalesReport(businessId: string, startDate?: string, endDate?: string) {
    let query = db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .where('invoices.business_id', businessId)
      .where('invoices.is_cancelled', false);

    if (startDate) query = query.where('invoices.invoice_date', '>=', startDate);
    if (endDate) query = query.where('invoices.invoice_date', '<=', endDate);

    const invoices = await query
      .select(
        'invoices.invoice_number',
        'invoices.invoice_date',
        'invoices.subtotal',
        'invoices.discount_amount',
        'invoices.tax_amount',
        'invoices.grand_total',
        'invoices.amount_paid',
        'invoices.balance_due',
        'invoices.payment_status',
        'customers.name as customer_name'
      )
      .orderBy('invoices.invoice_date', 'desc');

    const totalSales = invoices.reduce((acc, i) => acc + Number(i.grand_total), 0);
    const totalCollected = invoices.reduce((acc, i) => acc + Number(i.amount_paid), 0);
    const totalDue = invoices.reduce((acc, i) => acc + Number(i.balance_due), 0);

    return {
      period: { startDate, endDate },
      summary: {
        totalInvoices: invoices.length,
        totalSales: Number(totalSales.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        totalDue: Number(totalDue.toFixed(2)),
      },
      items: invoices,
    };
  }

  public static async getProfitLossReport(businessId: string, startDate?: string, endDate?: string) {
    let salesQuery = db('invoices')
      .where('business_id', businessId)
      .where('is_cancelled', false);

    let expenseQuery = db('expenses')
      .where('business_id', businessId);

    if (startDate) {
      salesQuery = salesQuery.where('invoice_date', '>=', startDate);
      expenseQuery = expenseQuery.where('expense_date', '>=', startDate);
    }
    if (endDate) {
      salesQuery = salesQuery.where('invoice_date', '<=', endDate);
      expenseQuery = expenseQuery.where('expense_date', '<=', endDate);
    }

    const [salesRes, expenseRes] = await Promise.all([
      salesQuery.sum<{ total: string }>('grand_total as total').first(),
      expenseQuery.sum<{ total: string }>('amount as total').first(),
    ]);

    const totalRevenue = Number(salesRes?.total || 0);
    const totalExpenses = Number(expenseRes?.total || 0);
    const netProfit = Number((totalRevenue - totalExpenses).toFixed(2));
    const profitMargin = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    return {
      period: { startDate, endDate },
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMarginPercent: profitMargin,
    };
  }
}
