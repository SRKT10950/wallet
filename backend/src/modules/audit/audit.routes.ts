import { Router } from 'express';
import { AppRequest } from '../../types/index.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { AuditService } from './audit.service.js';

const router = Router();

router.get(
  '/',
  deviceSecurityGuard(),
  authGuard,
  requirePermission('audit:read'),
  async (req: AppRequest, res, next) => {
    try {
      const logs = await AuditService.getLogs(req.user!.businessId, req.query);
      res.json({
        success: true,
        data: logs.items,
        error: null,
        requestId: req.id,
        meta: logs.meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
