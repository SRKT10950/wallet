import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { generateApiKey } from '../../utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

router.use(deviceSecurityGuard(), authGuard);

/**
 * GET /api/v1/applications
 */
router.get('/', requirePermission('settings:manage'), async (req: AppRequest, res, next) => {
  try {
    const apps = await db('applications').select('*').orderBy('name', 'asc');
    res.json({
      success: true,
      data: apps,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/applications/api-keys
 */
router.get('/api-keys', requirePermission('settings:manage'), async (req: AppRequest, res, next) => {
  try {
    const keys = await db('api_keys')
      .join('applications', 'api_keys.application_id', 'applications.id')
      .where('api_keys.business_id', req.user!.businessId)
      .select(
        'api_keys.id',
        'api_keys.name',
        'api_keys.key_prefix',
        'api_keys.is_active',
        'api_keys.expires_at',
        'api_keys.revoked_at',
        'api_keys.created_at',
        'applications.name as application_name',
        'applications.platform'
      )
      .orderBy('api_keys.created_at', 'desc');

    res.json({
      success: true,
      data: keys,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications/api-keys
 * Issues a new API key for a registered application
 */
router.post('/api-keys', requirePermission('settings:manage'), async (req: AppRequest, res, next) => {
  try {
    const schema = z.object({
      applicationId: z.string().uuid(),
      name: z.string().min(2),
      expiresInDays: z.coerce.number().optional(),
    });

    const input = schema.parse(req.body);
    const { apiKey, keyHash, keyPrefix } = generateApiKey();

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [created] = await db('api_keys').insert({
      business_id: req.user!.businessId,
      application_id: input.applicationId,
      name: input.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      is_active: true,
      expires_at: expiresAt,
    }).returning('*');

    await AuditService.logRequest(req, 'API_KEY_CREATED', 'api_keys', created.id, {
      name: input.name,
      keyPrefix,
      applicationId: input.applicationId,
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        name: created.name,
        keyPrefix: created.key_prefix,
        // ONE-TIME RAW KEY DISPLAY
        apiKey,
        expiresAt: created.expires_at,
      },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications/api-keys/:id/revoke
 */
router.post('/api-keys/:id/revoke', requirePermission('settings:manage'), async (req: AppRequest, res, next) => {
  try {
    const [updated] = await db('api_keys')
      .where({ id: req.params.id, business_id: req.user!.businessId })
      .update({
        is_active: false,
        revoked_at: new Date(),
      })
      .returning('*');

    if (!updated) {
      throw { status: 404, message: 'API key not found' };
    }

    await AuditService.logRequest(req, 'API_KEY_REVOKED', 'api_keys', req.params.id);

    res.json({
      success: true,
      data: { message: 'API key revoked successfully.' },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
