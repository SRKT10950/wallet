import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, LogIn, Loader2 } from 'lucide-react';
import { DeviceSetupModal } from '../components/DeviceSetupModal';

export const LoginPage: React.FC = () => {
  const { login, isEnrolled, deviceCreds } = useAuth();
  const [identifier, setIdentifier] = useState('admin@mywallet.local');
  const [password, setPassword] = useState('AdminWallet@2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEnrolled) {
      setShowDeviceModal(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl mx-auto flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-brand-500/30 mb-3">
            W
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Wallet</h1>
          <p className="text-sm text-slate-500 mt-1">Shopkeeper Business Portal</p>
        </div>

        {/* Device Enrollment Status */}
        <div
          onClick={() => setShowDeviceModal(true)}
          className={`mb-6 p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
            isEnrolled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isEnrolled ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {isEnrolled ? 'Device Enrolled' : 'Device Not Enrolled'}
              </p>
              <p className="text-[11px] opacity-80">
                {isEnrolled ? deviceCreds?.deviceName : 'Click to register terminal security key'}
              </p>
            </div>
          </div>
          <span className="text-[11px] underline font-medium">Configure</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email or Phone
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="admin@mywallet.local"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-md shadow-brand-500/20 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Authenticating...' : 'Sign In to Wallet'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
          Default seed credentials:
          <br />
          <span className="font-mono text-slate-600">admin@mywallet.local / AdminWallet@2026!</span>
        </div>
      </div>

      <DeviceSetupModal isOpen={showDeviceModal} onClose={() => setShowDeviceModal(false)} />
    </div>
  );
};
