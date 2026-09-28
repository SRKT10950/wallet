import { Response, NextFunction } from 'express';
import { AppRequest, DeviceStatus, DeviceType } from '../types/index.js';
import { db } from '../database/index.js';
import { hashKey, safeCompare } from '../utils/crypto.js';

export interface DeviceSecurityOptions {
  requireDevice?: boolean;
}

export function deviceSecurityGuard(options: DeviceSecurityOptions = { requireDevice: true }) {
  return async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKeyHeader = req.headers['x-api-key'] as string;
      const deviceKeyHeader = req.headers['x-device-security-key'] as string;
      const deviceNameHeader = req.headers['x-device-name'] as string;
      const deviceTypeHeader = req.headers['x-device-type'] as string;
      const appNameHeader = req.headers['x-app-name'] as string;
      const locationHeader = req.headers['x-location'] as string;

      // 1. Verify API Key
      if (!apiKeyHeader) {
        res.status(401).json({
          success: false,
          data: null,
          error: {
            code: 'API_KEY_REQUIRED',
            message: 'Missing required X-API-Key header.',
          },
          requestId: req.id,
        });
        return;
      }

      const apiKeyHash = hashKey(apiKeyHeader);
      const apiKeyRecord = await db('api_keys')
        .join('applications', 'api_keys.application_id', 'applications.id')
        .select(
          'api_keys.id as api_key_id',
          'api_keys.business_id',
          'api_keys.is_active as key_active',
          'api_keys.expires_at',
          'api_keys.revoked_at',
          'applications.id as application_id',
          'applications.name as app_name',
          'applications.app_identifier',
          'applications.platform',
          'applications.is_active as app_active'
        )
        .where('api_keys.key_hash', apiKeyHash)
        .first();

      if (!apiKeyRecord || !apiKeyRecord.key_active || !apiKeyRecord.app_active) {
        res.status(401).json({
          success: false,
          data: null,
          error: {
            code: 'INVALID_API_KEY',
            message: 'The provided API Key is invalid or inactive.',
          },
          requestId: req.id,
        });
        return;
      }

      if (apiKeyRecord.revoked_at || (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date())) {
        res.status(401).json({
          success: false,
          data: null,
          error: {
            code: 'API_KEY_EXPIRED',
            message: 'The provided API Key has expired or been revoked.',
          },
          requestId: req.id,
        });
        return;
      }

      req.application = {
        id: apiKeyRecord.application_id,
        name: apiKeyRecord.app_name,
        appIdentifier: apiKeyRecord.app_identifier,
        platform: apiKeyRecord.platform,
      };

      // If route does not strictly require device headers (e.g. registration endpoint), pass
      if (!options.requireDevice) {
        return next();
      }

      // 2. Validate Device Headers
      if (!deviceKeyHeader) {
        res.status(401).json({
          success: false,
          data: null,
          error: {
            code: 'DEVICE_SECURITY_KEY_REQUIRED',
            message: 'Missing required X-Device-Security-Key header.',
          },
          requestId: req.id,
        });
        return;
      }

      const deviceKeyHash = hashKey(deviceKeyHeader);
      const deviceRecord = await db('devices')
        .where({
          security_key_hash: deviceKeyHash,
          application_id: apiKeyRecord.application_id,
        })
        .first();

      if (!deviceRecord) {
        res.status(401).json({
          success: false,
          data: null,
          error: {
            code: 'UNREGISTERED_DEVICE',
            message: 'Device credentials not recognized for this application.',
          },
          requestId: req.id,
        });
        return;
      }

      // Check Status
      if (deviceRecord.status === 'REVOKED') {
        res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'DEVICE_REVOKED',
            message: 'This device is no longer authorized.',
          },
          requestId: req.id,
        });
        return;
      }

      if (deviceRecord.status === 'SUSPENDED') {
        res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'DEVICE_SUSPENDED',
            message: 'This device has been temporarily suspended by an administrator.',
          },
          requestId: req.id,
        });
        return;
      }

      if (deviceRecord.status === 'PENDING') {
        res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'DEVICE_PENDING_ACTIVATION',
            message: 'Device enrollment is pending administrative activation.',
          },
          requestId: req.id,
        });
        return;
      }

      // Validate location if supplied in header
      if (locationHeader && deviceRecord.location_id !== locationHeader) {
        res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'LOCATION_MISMATCH',
            message: 'Device is not authorized for the specified location.',
          },
          requestId: req.id,
        });
        return;
      }

      // Check optional IP allowlist
      if (deviceRecord.allowed_ip_range) {
        const allowed = deviceRecord.allowed_ip_range.split(',').map((ip: string) => ip.trim());
        if (!allowed.includes(req.clientIp)) {
          res.status(403).json({
            success: false,
            data: null,
            error: {
              code: 'IP_NOT_ALLOWED',
              message: 'Access from this IP address is not permitted for this device.',
            },
            requestId: req.id,
          });
          return;
        }
      }

      // Update last seen asynchronously without blocking response
      db('devices')
        .where({ id: deviceRecord.id })
        .update({
          last_seen_at: new Date(),
          last_seen_ip: req.clientIp,
        })
        .catch((err) => console.error('[DEVICE UPDATE ERROR]', err));

      req.device = {
        id: deviceRecord.id,
        deviceId: deviceRecord.device_id,
        deviceName: deviceRecord.device_name,
        deviceType: deviceRecord.device_type as DeviceType,
        locationId: deviceRecord.location_id,
        applicationId: deviceRecord.application_id,
        status: deviceRecord.status as DeviceStatus,
        allowedIpRange: deviceRecord.allowed_ip_range,
      };

      req.locationId = locationHeader || deviceRecord.location_id;

      next();
    } catch (error) {
      console.error('[DEVICE SECURITY ERROR]', error);
      res.status(500).json({
        success: false,
        data: null,
        error: {
          code: 'SECURITY_VERIFICATION_FAILED',
          message: 'An internal error occurred during client security verification.',
        },
        requestId: req.id,
      });
    }
  };
}
