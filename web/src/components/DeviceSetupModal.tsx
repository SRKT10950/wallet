import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { detectDeviceType, getOrCreateInstallationId } from '../services/deviceIdentity';
import { ShieldCheck, Smartphone, Laptop, AlertCircle, Loader2 } from 'lucide-react';

interface DeviceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceSetupModal: React.FC<DeviceSetupModalProps> = ({ isOpen, onClose }) => {
  const { enrollDevice } = useAuth();
  const [apiKey, setApiKey] = useState('mw_live_pwa_web_app_key_secure_2026');
  const [deviceName, setDeviceName] = useState(`PWA Terminal ${Math.floor(1000 + Math.random() * 9000)}`);
  const [deviceType, setDeviceType] = useState<'Desktop' | 'Mobile'>(detectDeviceType());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const installationId = getOrCreateInstallationId();

      // Temporarily store API Key to allow request to send X-API-Key
      localStorage.setItem('my_wallet_device_creds', JSON.stringify({
        apiKey,
        appName: 'My Wallet PWA',
      }));

      const res = await api.registerDevice({
        deviceName,
        deviceType,
        appVersion: '1.0.0',
        osVersion: navigator.userAgent.slice(0, 50),
      });

      if (res.data?.deviceSecurityKey) {
        enrollDevice({
          apiKey,
          deviceSecurityKey: res.data.deviceSecurityKey,
          deviceId: res.data.deviceId || installationId,
          deviceName: res.data.deviceName,
          deviceType,
          locationId: res.data.locationId,
          appName: 'My Wallet PWA',
        });
        onClose();
      } else {
        throw new Error('Server did not return a device security credential.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enroll device with server.');
      localStorage.removeItem('my_wallet_device_creds');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Device Security Enrollment</h2>
            <p className="text-xs text-slate-500">Every terminal must be securely registered</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEnroll} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Application API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="mw_live_..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Terminal / Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g. Counter 1 Desktop"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Device Form Factor
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeviceType('Desktop')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                  deviceType === 'Desktop'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Laptop className="w-4 h-4" /> Desktop / Browser
              </button>
              <button
                type="button"
                onClick={() => setDeviceType('Mobile')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                  deviceType === 'Mobile'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Mobile / Tablet
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Device Security Policy:</p>
            <p>1. Generates a 384-bit cryptographic device credential.</p>
            <p>2. Hardware identifiers are NEVER invasively collected.</p>
            <p>3. Revoking this terminal in Admin immediately cuts API access.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Enrolling Terminal...' : 'Complete Secure Enrollment'}
          </button>
        </form>
      </div>
    </div>
  );
};
