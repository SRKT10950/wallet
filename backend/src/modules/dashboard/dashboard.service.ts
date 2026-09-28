import { db } from '../../database/index.js';

export class DashboardService {
  public static async getSummary(businessId: string, locationId?: string) {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Today's Sales
    let todaySalesQuery = db('invoices')
      .where({ business_id: businessId, invoice_date: today, is_cancelled: false });
    if (locationId) todaySalesQuery = todaySalesQuery.where({ location_id: locationId });
    const todaySalesRes = await todaySalesQuery.sum<{ total: string }>('grand_total as total').first();
    const todaySales = Number(todaySalesRes?.total || 0);

    // Today's Expenses
    let todayExpensesQuery = db('expenses')
      .where({ business_id: businessId, expense_date: today });
    if (locationId) todayExpensesQuery = todayExpensesQuery.where({ location_id: locationId });
    const todayExpensesRes = await todayExpensesQuery.sum<{ total: string }>('amount as total').first();
    const todayExpenses = Number(todayExpensesRes?.total || 0);

    // Today's Estimated Profit
    const todayProfit = Number((todaySales - todayExpenses).toFixed(2));

    // Invoices Counts Today
    let todayInvoicesQuery = db('invoices')
      .where({ business_id: businessId, invoice_date: today, is_cancelled: false });
    if (locationId) todayInvoicesQuery = todayInvoicesQuery.where({ location_id: locationId });
    const todayInvoicesCount = await todayInvoicesQuery.count<{ count: string }>('id as count').first();

    // Outstanding Payments across business
    let outstandingQuery = db('invoices')
      .where({ business_id: businessId, is_cancelled: false })
      .whereIn('payment_status', ['UNPAID', 'PARTIALLY_PAID']);
    if (locationId) outstandingQuery = outstandingQuery.where({ location_id: locationId });
    const outstandingRes = await outstandingQuery.sum<{ total: string }>('balance_due as total').first();
    const outstandingAmount = Number(outstandingRes?.total || 0);

    // Paid & Unpaid counts
    let paidQuery = db('invoices').where({ business_id: businessId, payment_status: 'PAID', is_cancelled: false });
    let unpaidQuery = db('invoices').where({ business_id: businessId, payment_status: 'UNPAID', is_cancelled: false });
    if (locationId) {
      paidQuery = paidQuery.where({ location_id: locationId });
      unpaidQuery = unpaidQuery.where({ location_id: locationId });
    }
    const [paidCountRes, unpaidCountRes] = await Promise.all([
      paidQuery.count<{ count: string }>('id as count').first(),
      unpaidQuery.count<{ count: string }>('id as count').first(),
    ]);

    // Monthly Sales & Expenses
    let monthlySalesQuery = db('invoices')
      .where('business_id', businessId)
      .where('invoice_date', '>=', firstDayOfMonth)
      .where('is_cancelled', false);
    let monthlyExpensesQuery = db('expenses')
      .where('business_id', businessId)
      .where('expense_date', '>=', firstDayOfMonth);

    if (locationId) {
      monthlySalesQuery = monthlySalesQuery.where({ location_id: locationId });
      monthlyExpensesQuery = monthlyExpensesQuery.where({ location_id: locationId });
    }

    const [monthlySalesRes, monthlyExpensesRes] = await Promise.all([
      monthlySalesQuery.sum<{ total: string }>('grand_total as total').first(),
      monthlyExpensesQuery.sum<{ total: string }>('amount as total').first(),
    ]);

    const mSales = Number(monthlySalesRes?.total || 0);
    const mExpenses = Number(monthlyExpensesRes?.total || 0);

    return {
      today: {
        sales: todaySales,
        expenses: todayExpenses,
        estimatedProfit: todayProfit,
        invoicesCount: Number(todayInvoicesCount?.count || 0),
      },
      monthly: {
        sales: mSales,
        expenses: mExpenses,
        estimatedProfit: Number((mSales - mExpenses).toFixed(2)),
      },
      invoices: {
        paidCount: Number(paidCountRes?.count || 0),
        unpaidCount: Number(unpaidCountRes?.count || 0),
        totalOutstanding: outstandingAmount,
      },
    };
  }

  public static async getCharts(businessId: string, days: number = 14) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 1. Sales by Day
    const salesByDay = (await db('invoices')
      .where('business_id', businessId)
      .where('invoice_date', '>=', startDateStr)
      .where('is_cancelled', false)
      .groupBy('invoice_date')
      .select('invoice_date as date')
      .sum('grand_total as total')
      .orderBy('invoice_date', 'asc')) as Array<{ date: string; total: string | number }>;

    // 2. Expenses by Day
    const expensesByDay = (await db('expenses')
      .where('business_id', businessId)
      .where('expense_date', '>=', startDateStr)
      .groupBy('expense_date')
      .select('expense_date as date')
      .sum('amount as total')
      .orderBy('expense_date', 'asc')) as Array<{ date: string; total: string | number }>;

    // Combine Sales vs Expenses by Day
    const dateMap = new Map<string, { date: string; sales: number; expenses: number }>();
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const str = d.toISOString().split('T')[0];
      dateMap.set(str, { date: str, sales: 0, expenses: 0 });
    }

    salesByDay.forEach((s) => {
      const entry = dateMap.get(s.date) || { date: s.date, sales: 0, expenses: 0 };
      entry.sales = Number(s.total || 0);
      dateMap.set(s.date, entry);
    });

    expensesByDay.forEach((e) => {
      const entry = dateMap.get(e.date) || { date: e.date, sales: 0, expenses: 0 };
      entry.expenses = Number(e.total || 0);
      dateMap.set(e.date, entry);
    });

    // 3. Expense Categories Breakdown
    const expenseCategories = (await db('expenses')
      .join('expense_categories', 'expenses.category_id', 'expense_categories.id')
      .where('expenses.business_id', businessId)
      .where('expenses.expense_date', '>=', startDateStr)
      .groupBy('expense_categories.name')
      .select('expense_categories.name as category')
      .sum('expenses.amount as total')) as Array<{ category: string; total: string | number }>;

    // 4. Payment Status Breakdown
    const paymentStatus = (await db('invoices')
      .where('business_id', businessId)
      .where('is_cancelled', false)
      .groupBy('payment_status')
      .select('payment_status as status')
      .count('id as count')) as Array<{ status: string; count: string | number }>;

    return {
      salesVsExpenses: Array.from(dateMap.values()),
      expenseCategories: expenseCategories.map((c) => ({
        category: c.category,
        total: Number(c.total || 0),
      })),
      paymentStatus: paymentStatus.map((p) => ({
        status: p.status,
        count: Number(p.count || 0),
      })),
    };
  }
}
