import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, deviceCreds, isOnline, pendingSyncCount, syncOfflineQueue, logout } = useAuth();
  const [syncing, setSyncing] = React.useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    await syncOfflineQueue();
    setSyncing(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
            W
          </div>
          <div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">My Wallet</span>
            <span className="hidden sm:inline-block ml-2 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium border border-brand-200">
              Business
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Device Identity Indicator */}
        {deviceCreds && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
            <span className="font-medium text-slate-700 truncate max-w-[120px]">{deviceCreds.deviceName}</span>
          </div>
        )}

        {/* Network & Offline Sync Status (Section 15 Requirement) */}
        {isOnline ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-medium">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="font-medium">Offline Mode</span>
          </div>
        )}

        {/* Pending Sync Items Button */}
        {pendingSyncCount > 0 && (
          <button
            onClick={handleManualSync}
            disabled={!isOnline || syncing}
            className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 transition"
            title="Click to sync pending operations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="font-medium">{pendingSyncCount} Pending Sync</span>
          </button>
        )}

        {/* User Profile & Logout */}
        {user && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
              {user.fullName.charAt(0)}
            </div>
            <div className="hidden sm:block text-left text-xs">
              <p className="font-semibold text-slate-900 leading-tight">{user.fullName}</p>
              <p className="text-slate-500 leading-tight">{user.roles[0] || 'Staff'}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition ml-1"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
