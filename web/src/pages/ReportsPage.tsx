import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [salesReport, setSalesReport] = useState<any>(null);
  const [plReport, setPlReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [salesRes, plRes] = await Promise.all([
        api.getSalesReport(),
        api.getProfitLossReport(),
      ]);
      setSalesReport(salesRes.data);
      setPlReport(plRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
        <p className="text-xs text-slate-500">Business performance, sales analytics, and profit statement</p>
      </div>

      {/* P&L Statement */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-600" /> Profit & Loss Statement (All-Time)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Revenue</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              ${Number(plReport?.totalRevenue || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Operating Expenses</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              ${Number(plReport?.totalExpenses || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Net Profit</span>
            <p className={`text-2xl font-bold mt-1 ${Number(plReport?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              ${Number(plReport?.netProfit || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Profit Margin</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {Number(plReport?.profitMarginPercent || 0).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" /> Sales Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-800 uppercase">Total Sales Billed</p>
            <p className="text-xl font-bold text-emerald-900 mt-1">
              ${Number(salesReport?.summary?.totalSales || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 uppercase">Collected Payments</p>
            <p className="text-xl font-bold text-blue-900 mt-1">
              ${Number(salesReport?.summary?.totalCollected || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <p className="text-xs font-semibold text-rose-800 uppercase">Outstanding Receivables</p>
            <p className="text-xl font-bold text-rose-900 mt-1">
              ${Number(salesReport?.summary?.totalDue || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
