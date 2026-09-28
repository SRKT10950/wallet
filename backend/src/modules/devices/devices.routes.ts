import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { DevicesService } from './devices.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const registerDeviceSchema = z.object({
  deviceName: z.string().min(2, 'Device name must be at least 2 characters'),
  deviceType: z.enum(['Mobile', 'Desktop', 'Server', 'IoT']),
  locationId: z.string().uuid().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
  allowedIpRange: z.string().optional(),
});

const updateDeviceSchema = z.object({
  deviceName: z.string().min(2).optional(),
  locationId: z.string().uuid().optional(),
  allowedIpRange: z.string().nullable().optional(),
});

/**
 * POST /api/v1/devices/register
 * Enrolls a new device under a registered Application (requires X-API-Key)
 */
router.post(
  '/register',
  deviceSecurityGuard({ requireDevice: false }),
  async (req: AppRequest, res, next) => {
    try {
      const input = registerDeviceSchema.parse(req.body);
      const enrolled = await DevicesService.registerDevice(req, input);
      res.status(201).json({
        success: true,
        data: enrolled,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/devices
 * Lists all registered devices for the current business
 */
router.get(
  '/',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('devices:manage'),
  async (req: AppRequest, res, next) => {
    try {
      const devices = await DevicesService.listDevices(req.user!.businessId, req.query);
      res.json({
        success: true,
        data: devices,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/devices/:id
 * Updates device settings (name, location, IP allowlist)
 */
router.put(
  '/:id',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('devices:manage'),
  async (req: AppRequest, res, next) => {
    try {
      const update = updateDeviceSchema.parse(req.body);
      const updated = await DevicesService.updateDevice(req, req.params.id, update);
      res.json({
        success: true,
        data: updated,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/devices/:id/activate
 */
router.post(
  '/:id/activate',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('devices:manage'),
  async (req: AppRequest, res, next) => {
    try {
      const updated = await DevicesService.setStatus(req, req.params.id, 'ACTIVE');
      res.json({
        success: true,
        data: updated,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/devices/:id/suspend
 */
router.post(
  '/:id/suspend',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('devices:manage'),
  async (req: AppRequest, res, next) => {
    try {
      const updated = await DevicesService.setStatus(req, req.params.id, 'SUSPENDED');
      res.json({
        success: true,
        data: updated,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/devices/:id/revoke
 * Immediately revokes device authorization
 */
router.post(
  '/:id/revoke',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('devices:manage'),
  async (req: AppRequest, res, next) => {
    try {
      const updated = await DevicesService.setStatus(req, req.params.id, 'REVOKED');
      res.json({
        success: true,
        data: updated,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/devices/:id/re-enroll
 */
router.post(
  '/:id/re-enroll',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('devices:manage'),
  async (req: AppRequest, res, next) => {
    try {
      const reEnrolled = await DevicesService.reEnrollDevice(req, req.params.id);
      res.json({
        success: true,
        data: reEnrolled,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
