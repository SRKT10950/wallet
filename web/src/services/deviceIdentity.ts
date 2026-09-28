import { DeviceCredentials } from '../types';

const STORAGE_KEY = 'my_wallet_device_creds';

/**
 * Detect device type based on userAgent without invasive fingerprinting
 */
export function detectDeviceType(): 'Mobile' | 'Desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|windows phone/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

/**
 * Get or initialize device credentials
 */
export function getStoredDeviceCredentials(): DeviceCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save device credentials locally
 */
export function saveDeviceCredentials(creds: DeviceCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

/**
 * Clears device registration
 */
export function clearDeviceCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Ensures a valid installation identifier exists
 */
export function getOrCreateInstallationId(): string {
  let installId = localStorage.getItem('my_wallet_installation_id');
  if (!installId) {
    installId = `pwa_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    localStorage.setItem('my_wallet_installation_id', installId);
  }
  return installId;
}
