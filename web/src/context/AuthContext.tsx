import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, DeviceCredentials, SyncItem } from '../types';
import { getStoredDeviceCredentials, saveDeviceCredentials, clearDeviceCredentials } from '../services/deviceIdentity';
import { api } from '../services/api';
import { OfflineQueue } from '../services/offlineQueue';

interface AuthContextType {
  user: User | null;
  deviceCreds: DeviceCredentials | null;
  isEnrolled: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enrollDevice: (creds: DeviceCredentials) => void;
  syncOfflineQueue: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [deviceCreds, setDeviceCreds] = useState<DeviceCredentials | null>(getStoredDeviceCredentials());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const updatePendingCount = async () => {
    try {
      const count = await OfflineQueue.getCount();
      setPendingSyncCount(count);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // Check initial user token
    const token = localStorage.getItem('my_wallet_token');
    const storedUser = localStorage.getItem('my_wallet_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('my_wallet_token');
        localStorage.removeItem('my_wallet_user');
      }
    }

    updatePendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    if (!navigator.onLine) return;
    const pending = await OfflineQueue.getPending();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        if (item.type === 'INVOICE') {
          await api.createInvoice(item.payload);
        } else if (item.type === 'EXPENSE') {
          await api.createExpense(item.payload);
        }
        await OfflineQueue.updateStatus(item.id, 'SYNCED');
      } catch (err: any) {
        await OfflineQueue.updateStatus(item.id, 'FAILED', err.message);
      }
    }
    await updatePendingCount();
  };

  const login = async (identifier: string, password: string) => {
    const res = await api.login({ identifier, password });
    if (res.data?.tokens?.accessToken) {
      localStorage.setItem('my_wallet_token', res.data.tokens.accessToken);
      localStorage.setItem('my_wallet_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('my_wallet_token');
    localStorage.removeItem('my_wallet_user');
    setUser(null);
  };

  const enrollDevice = (creds: DeviceCredentials) => {
    saveDeviceCredentials(creds);
    setDeviceCreds(creds);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        deviceCreds,
        isEnrolled: !!deviceCreds?.deviceSecurityKey,
        isOnline,
        pendingSyncCount,
        login,
        logout,
        enrollDevice,
        syncOfflineQueue,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
