import { Request } from 'express';
import 'express-serve-static-core';

export type DeviceType = 'Mobile' | 'Desktop' | 'Server' | 'IoT';
export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface AuthenticatedUser {
  id: string;
  businessId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  defaultLocationId?: string;
}

export interface VerifiedDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  locationId: string;
  applicationId: string;
  status: DeviceStatus;
  allowedIpRange?: string | null;
}

export interface VerifiedApplication {
  id: string;
  name: string;
  appIdentifier: string;
  platform: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    clientIp: string;
    user?: AuthenticatedUser;
    device?: VerifiedDevice;
    application?: VerifiedApplication;
    locationId?: string;
  }
}

export type AppRequest = Request;

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
  requestId: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
