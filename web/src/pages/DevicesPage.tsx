import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DeviceRecord } from '../types';
import { Smartphone, Laptop, ShieldCheck, ShieldAlert, Ban, PauseCircle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

export const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await api.getDevices();
      setDevices(res.data || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to REVOKE access for "${name}"? This device will immediately lose all API access.`)) {
      return;
    }
    setActionLoading(id);
    try {
      await api.revokeDevice(id);
      fetchDevices();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    try {
      await api.suspendDevice(id);
      fetchDevices();
    } catch (err: any) {
      alert(err.message || 'Failed to suspend device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    try {
      await api.activateDevice(id);
      fetchDevices();
    } catch (err: any) {
      alert(err.message || 'Failed to activate device');
    } finally {
      setActionLoading(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> ACTIVE
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <PauseCircle className="w-3 h-3 text-amber-600" /> SUSPENDED
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <Ban className="w-3 h-3 text-rose-600" /> REVOKED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            PENDING
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrolled Devices & Terminals</h1>
          <p className="text-xs text-slate-500">
            Manage device authorizations, observe terminal activity, and revoke access
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Device Name</th>
                <th className="py-3 px-4">Installation ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Assigned Location</th>
                <th className="py-3 px-4">Last Observed IP</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading devices...</td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">No devices enrolled yet.</td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      {d.device_type === 'Mobile' ? (
                        <Smartphone className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Laptop className="w-4 h-4 text-slate-400" />
                      )}
                      {d.device_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{d.device_id}</td>
                    <td className="py-3.5 px-4 text-slate-600">{d.device_type}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{d.location_name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{d.last_seen_ip || 'Never'}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-center">{renderStatusBadge(d.status)}</td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      {d.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleSuspend(d.id)}
                          disabled={actionLoading === d.id}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold transition"
                        >
                          Suspend
                        </button>
                      )}
                      {d.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleActivate(d.id)}
                          disabled={actionLoading === d.id}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold transition"
                        >
                          Activate
                        </button>
                      )}
                      {d.status !== 'REVOKED' && (
                        <button
                          onClick={() => handleRevoke(d.id, d.device_name)}
                          disabled={actionLoading === d.id}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold transition"
                        >
                          Revoke
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
    </div>
  );
};
