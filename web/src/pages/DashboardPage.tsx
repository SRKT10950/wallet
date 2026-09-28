import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Clock,
  CheckCircle2,
  Calendar,
  Plus,
} from 'lucide-react';

interface DashboardPageProps {
  onNewInvoice: () => void;
  onNewExpense: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNewInvoice, onNewExpense }) => {
  const [summary, setSummary] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, chartRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardCharts(14),
      ]);
      setSummary(sumRes.data);
      setCharts(chartRes.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading dashboard metrics...
      </div>
    );
  }

  const today = summary?.today || {};
  const monthly = summary?.monthly || {};
  const invoices = summary?.invoices || {};

  return (
    <div className="space-y-6">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
          <p className="text-xs text-slate-500">Real-time financial performance and shop metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewExpense}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
          <button
            onClick={onNewInvoice}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Sales"
          value={`$${Number(today.sales || 0).toFixed(2)}`}
          subtext={`${today.invoicesCount || 0} invoices created today`}
          icon={TrendingUp}
          variant="emerald"
        />
        <MetricCard
          title="Today's Expenses"
          value={`$${Number(today.expenses || 0).toFixed(2)}`}
          subtext="Store operating expenses"
          icon={TrendingDown}
          variant="rose"
        />
        <MetricCard
          title="Today's Estimated Profit"
          value={`$${Number(today.estimatedProfit || 0).toFixed(2)}`}
          subtext="Sales minus expenses"
          icon={DollarSign}
          variant={Number(today.estimatedProfit || 0) >= 0 ? 'emerald' : 'rose'}
        />
        <MetricCard
          title="Outstanding Due"
          value={`$${Number(invoices.totalOutstanding || 0).toFixed(2)}`}
          subtext={`${invoices.unpaidCount || 0} unpaid / partial invoices`}
          icon={Clock}
          variant="amber"
        />
      </div>

      {/* Monthly Summary Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-600" /> Current Month Business Totals
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border-l-4 border-emerald-500 pl-4">
            <p className="text-xs text-slate-500">Monthly Revenue</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              ${Number(monthly.sales || 0).toFixed(2)}
            </p>
          </div>
          <div className="border-l-4 border-rose-500 pl-4">
            <p className="text-xs text-slate-500">Monthly Expenses</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              ${Number(monthly.expenses || 0).toFixed(2)}
            </p>
          </div>
          <div className="border-l-4 border-brand-500 pl-4">
            <p className="text-xs text-slate-500">Net Estimated Profit</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              ${Number(monthly.estimatedProfit || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Trend Bars (Sales vs Expenses by Day) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">14-Day Sales vs Expenses</h2>
          {charts?.salesVsExpenses?.length > 0 ? (
            <div className="space-y-3">
              {charts.salesVsExpenses.slice(-7).map((item: any) => {
                const maxVal = Math.max(
                  ...charts.salesVsExpenses.map((x: any) => Math.max(x.sales, x.expenses)),
                  100
                );
                const salesPercent = Math.min(100, Math.round((item.sales / maxVal) * 100));
                const expensePercent = Math.min(100, Math.round((item.expenses / maxVal) * 100));

                return (
                  <div key={item.date} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span>{item.date}</span>
                      <div className="flex gap-4">
                        <span className="text-emerald-700 font-semibold">${item.sales.toFixed(2)}</span>
                        <span className="text-rose-600 font-semibold">${item.expenses.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                      <div
                        style={{ width: `${salesPercent}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                        title={`Sales: $${item.sales}`}
                      />
                      <div
                        style={{ width: `${expensePercent}%` }}
                        className="h-full bg-rose-500 rounded-full"
                        title={`Expenses: $${item.expenses}`}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-end gap-4 pt-2 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Sales
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Expenses
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">No trend data available yet.</p>
          )}
        </div>

        {/* Expense Categories Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Expense Categories</h2>
          {charts?.expenseCategories?.length > 0 ? (
            <div className="space-y-3">
              {charts.expenseCategories.map((c: any) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">{c.category}</span>
                  <span className="font-bold text-slate-900">${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">No expenses recorded in this period.</p>
          )}
        </div>
      </div>
    </div>
  );
};
