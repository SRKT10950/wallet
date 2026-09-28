import { Router } from 'express';
import { AppRequest } from '../../types/index.js';
import { ReportsService } from './reports.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

router.use(deviceSecurityGuard(), authGuard);

router.get('/sales', requirePermission('reports:read'), async (req: AppRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const report = await ReportsService.getSalesReport(req.user!.businessId, startDate, endDate);
    res.json({
      success: true,
      data: report,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/profit-loss', requirePermission('reports:read'), async (req: AppRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const report = await ReportsService.getProfitLossReport(req.user!.businessId, startDate, endDate);
    res.json({
      success: true,
      data: report,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
