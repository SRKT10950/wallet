import { v4 as uuidv4 } from 'uuid';
import { db } from '../../database/index.js';
import { generateRandomToken, hashKey } from '../../utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';
import { AppRequest, DeviceType, DeviceStatus } from '../../types/index.js';

export interface DeviceRegisterInput {
  deviceName: string;
  deviceType: DeviceType;
  locationId?: string;
  osVersion?: string;
  appVersion?: string;
  allowedIpRange?: string;
}

export class DevicesService {
  /**
   * Enroll a new client device
   */
  public static async registerDevice(req: AppRequest, input: DeviceRegisterInput) {
    if (!req.application) {
      throw { status: 400, code: 'APP_NOT_IDENTIFIED', message: 'Application context missing from API key.' };
    }

    // Default to the first location if none provided
    let locationId = input.locationId;
    let businessId = req.user?.businessId;

    if (!locationId || !businessId) {
      const location = await db('locations').first();
      if (!location) {
        throw { status: 400, code: 'LOCATION_NOT_FOUND', message: 'No valid location found to assign device.' };
      }
      locationId = location.id;
      businessId = location.business_id;
    }

    // Generate installation ID and one-time secret device credential
    const installationId = `dev_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const rawDeviceSecurityKey = generateRandomToken(48);
    const securityKeyHash = hashKey(rawDeviceSecurityKey);

    const [device] = await db('devices').insert({
      business_id: businessId,
      location_id: locationId,
      application_id: req.application.id,
      device_id: installationId,
      device_name: input.deviceName,
      device_type: input.deviceType,
      os_version: input.osVersion || null,
      app_version: input.appVersion || null,
      security_key_hash: securityKeyHash,
      status: 'ACTIVE', // Enrolled and active
      allowed_ip_range: input.allowedIpRange || null,
      last_seen_ip: req.clientIp,
      last_seen_at: new Date(),
    }).returning('*');

    await AuditService.logRequest(req, 'DEVICE_REGISTERED', 'devices', device.id, {
      deviceId: device.device_id,
      deviceName: device.device_name,
      deviceType: device.device_type,
      locationId: device.location_id,
    });

    return {
      id: device.id,
      deviceId: device.device_id,
      deviceName: device.device_name,
      deviceType: device.device_type,
      locationId: device.location_id,
      status: device.status,
      // One-time security key: MUST BE STORED BY CLIENT IMMEDIATELY
      deviceSecurityKey: rawDeviceSecurityKey,
      enrolledAt: device.enrolled_at,
    };
  }

  /**
   * List all registered devices for a business
   */
  public static async listDevices(businessId: string, filter?: { status?: string; locationId?: string }) {
    let query = db('devices')
      .join('applications', 'devices.application_id', 'applications.id')
      .join('locations', 'devices.location_id', 'locations.id')
      .where('devices.business_id', businessId)
      .select(
        'devices.id',
        'devices.device_id',
        'devices.device_name',
        'devices.device_type',
        'devices.status',
        'devices.os_version',
        'devices.app_version',
        'devices.allowed_ip_range',
        'devices.last_seen_at',
        'devices.last_seen_ip',
        'devices.enrolled_at',
        'devices.revoked_at',
        'applications.name as app_name',
        'applications.platform',
        'locations.id as location_id',
        'locations.name as location_name',
        'locations.code as location_code'
      )
      .orderBy('devices.created_at', 'desc');

    if (filter?.status) {
      query = query.where('devices.status', filter.status);
    }
    if (filter?.locationId) {
      query = query.where('devices.location_id', filter.locationId);
    }

    return await query;
  }

  /**
   * Update device configuration
   */
  public static async updateDevice(
    req: AppRequest,
    id: string,
    update: { deviceName?: string; locationId?: string; allowedIpRange?: string | null }
  ) {
    const device = await db('devices').where({ id, business_id: req.user!.businessId }).first();
    if (!device) {
      throw { status: 404, code: 'DEVICE_NOT_FOUND', message: 'Device not found.' };
    }

    const [updated] = await db('devices')
      .where({ id })
      .update({
        device_name: update.deviceName ?? device.device_name,
        location_id: update.locationId ?? device.location_id,
        allowed_ip_range: update.allowedIpRange !== undefined ? update.allowedIpRange : device.allowed_ip_range,
        updated_at: new Date(),
      })
      .returning('*');

    await AuditService.logRequest(req, 'DEVICE_UPDATED', 'devices', id, { update });
    return updated;
  }

  /**
   * Set status (ACTIVE, SUSPENDED, REVOKED)
   */
  public static async setStatus(req: AppRequest, id: string, status: DeviceStatus) {
    const device = await db('devices').where({ id, business_id: req.user!.businessId }).first();
    if (!device) {
      throw { status: 404, code: 'DEVICE_NOT_FOUND', message: 'Device not found.' };
    }

    const updates: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'REVOKED') {
      updates.revoked_at = new Date();
    }

    const [updated] = await db('devices').where({ id }).update(updates).returning('*');

    // If revoked or suspended, terminate any active sessions tied to this device
    if (status === 'REVOKED' || status === 'SUSPENDED') {
      await db('sessions').where({ device_id: device.device_id }).update({ is_active: false });
    }

    await AuditService.logRequest(req, `DEVICE_${status}`, 'devices', id, {
      deviceId: device.device_id,
      previousStatus: device.status,
      newStatus: status,
    });

    return updated;
  }

  /**
   * Re-enroll device by generating a new secret key
   */
  public static async reEnrollDevice(req: AppRequest, id: string) {
    const device = await db('devices').where({ id, business_id: req.user!.businessId }).first();
    if (!device) {
      throw { status: 404, code: 'DEVICE_NOT_FOUND', message: 'Device not found.' };
    }

    const newRawKey = generateRandomToken(48);
    const newHash = hashKey(newRawKey);

    await db('devices').where({ id }).update({
      security_key_hash: newHash,
      status: 'ACTIVE',
      revoked_at: null,
      updated_at: new Date(),
    });

    await AuditService.logRequest(req, 'DEVICE_REENROLLED', 'devices', id, {
      deviceId: device.device_id,
    });

    return {
      id: device.id,
      deviceId: device.device_id,
      deviceSecurityKey: newRawKey,
      status: 'ACTIVE',
    };
  }
}
