import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';

export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  businessId?: string | null;
  userId?: string | null;
  deviceId?: string | null;
  applicationId?: string | null;
  locationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  success?: boolean;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Appends an immutable audit log entry.
   * Modifying or deleting audit entries is blocked by database triggers.
   */
  public static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db('audit_logs').insert({
        business_id: entry.businessId || null,
        user_id: entry.userId || null,
        device_id: entry.deviceId || null,
        application_id: entry.applicationId || null,
        location_id: entry.locationId || null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        request_id: entry.requestId || null,
        success: entry.success ?? true,
        metadata: JSON.stringify(entry.metadata || {}),
        event_timestamp: new Date(),
      });
    } catch (err) {
      console.error('[AUDIT LOG ERROR] Failed to record audit log:', err);
    }
  }

  /**
   * Helper that extracts contextual data directly from the Express request
   */
  public static async logRequest(
    req: AppRequest,
    action: string,
    resourceType: string,
    resourceId?: string | null,
    metadata?: Record<string, any>,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      action,
      resourceType,
      resourceId: resourceId || null,
      businessId: req.user?.businessId || null,
      userId: req.user?.id || null,
      deviceId: req.device?.id || null,
      applicationId: req.application?.id || null,
      locationId: req.locationId || req.user?.defaultLocationId || null,
      ipAddress: req.clientIp || null,
      userAgent: (req.headers['user-agent'] as string) || null,
      requestId: req.id,
      success,
      metadata,
    });
  }

  /**
   * Fetch paginated audit logs for admin/owner inspection
   */
  public static async getLogs(businessId: string, query: {
    page?: number;
    limit?: number;
    action?: string;
    resourceType?: string;
    userId?: string;
    deviceId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseQuery = db('audit_logs')
      .where('audit_logs.business_id', businessId);

    if (query.action) {
      baseQuery = baseQuery.where('audit_logs.action', query.action);
    }
    if (query.resourceType) {
      baseQuery = baseQuery.where('audit_logs.resource_type', query.resourceType);
    }
    if (query.userId) {
      baseQuery = baseQuery.where('audit_logs.user_id', query.userId);
    }
    if (query.deviceId) {
      baseQuery = baseQuery.where('audit_logs.device_id', query.deviceId);
    }
    if (query.startDate) {
      baseQuery = baseQuery.where('audit_logs.event_timestamp', '>=', new Date(query.startDate));
    }
    if (query.endDate) {
      baseQuery = baseQuery.where('audit_logs.event_timestamp', '<=', new Date(query.endDate));
    }

    const countRes = await baseQuery.clone().count<{ count: string }>('audit_logs.id as count').first();
    const total = Number(countRes?.count || 0);

    const rows = await baseQuery
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .leftJoin('devices', 'audit_logs.device_id', 'devices.id')
      .select(
        'audit_logs.id',
        'audit_logs.event_timestamp',
        'audit_logs.action',
        'audit_logs.resource_type',
        'audit_logs.resource_id',
        'audit_logs.ip_address',
        'audit_logs.request_id',
        'audit_logs.success',
        'audit_logs.metadata',
        'users.full_name as user_name',
        'users.email as user_email',
        'devices.device_name',
        'devices.device_type'
      )
      .orderBy('audit_logs.event_timestamp', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
