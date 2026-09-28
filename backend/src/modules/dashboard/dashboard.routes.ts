import { Router } from 'express';
import { AppRequest } from '../../types/index.js';
import { DashboardService } from './dashboard.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

router.use(deviceSecurityGuard(), authGuard);

router.get('/summary', requirePermission('reports:read'), async (req: AppRequest, res, next) => {
  try {
    const summary = await DashboardService.getSummary(req.user!.businessId, req.locationId);
    res.json({
      success: true,
      data: summary,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/charts', requirePermission('reports:read'), async (req: AppRequest, res, next) => {
  try {
    const days = Math.min(60, Math.max(7, Number(req.query.days) || 14));
    const charts = await DashboardService.getCharts(req.user!.businessId, days);
    res.json({
      success: true,
      data: charts,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
