import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { CustomersService } from './customers.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  taxNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('customer:read'), async (req: AppRequest, res, next) => {
  try {
    const result = await CustomersService.list(req.user!.businessId, req.query);
    res.json({
      success: true,
      data: result.items,
      error: null,
      requestId: req.id,
      meta: result.meta,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('customer:read'), async (req: AppRequest, res, next) => {
  try {
    const customer = await CustomersService.getById(req.user!.businessId, req.params.id);
    res.json({
      success: true,
      data: customer,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('customer:create'), async (req: AppRequest, res, next) => {
  try {
    const input = customerSchema.parse(req.body);
    const created = await CustomersService.create(req, input);
    res.status(201).json({
      success: true,
      data: created,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('customer:update'), async (req: AppRequest, res, next) => {
  try {
    const input = customerSchema.partial().parse(req.body);
    const updated = await CustomersService.update(req, req.params.id, input);
    res.json({
      success: true,
      data: updated,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('customer:delete'), async (req: AppRequest, res, next) => {
  try {
    await CustomersService.delete(req, req.params.id);
    res.json({
      success: true,
      data: { message: 'Customer deleted successfully.' },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
