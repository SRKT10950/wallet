import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { ExpensesService } from './expenses.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const expenseSchema = z.object({
  categoryId: z.string().uuid('Valid Category ID is required'),
  locationId: z.string().uuid().optional(),
  expenseDate: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  paymentMethod: z.string().optional().default('CASH'),
  reference: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('expense:read'), async (req: AppRequest, res, next) => {
  try {
    const result = await ExpensesService.list(req.user!.businessId, req.query);
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

router.get('/summary', requirePermission('expense:read'), async (req: AppRequest, res, next) => {
  try {
    const period = (req.query.period as any) || 'daily';
    const summary = await ExpensesService.getSummary(req.user!.businessId, period);
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

router.get('/categories', requirePermission('expense:read'), async (req: AppRequest, res, next) => {
  try {
    const categories = await ExpensesService.listCategories(req.user!.businessId);
    res.json({
      success: true,
      data: categories,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', requirePermission('expense:create'), async (req: AppRequest, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) throw { status: 400, message: 'Category name is required' };
    const cat = await ExpensesService.createCategory(req.user!.businessId, name, description);
    res.status(201).json({
      success: true,
      data: cat,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('expense:read'), async (req: AppRequest, res, next) => {
  try {
    const expense = await ExpensesService.getById(req.user!.businessId, req.params.id);
    res.json({
      success: true,
      data: expense,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('expense:create'), async (req: AppRequest, res, next) => {
  try {
    const input = expenseSchema.parse(req.body);
    const expense = await ExpensesService.create(req, input);
    res.status(201).json({
      success: true,
      data: expense,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('expense:update'), async (req: AppRequest, res, next) => {
  try {
    const input = expenseSchema.partial().parse(req.body);
    const updated = await ExpensesService.update(req, req.params.id, input);
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

router.delete('/:id', requirePermission('expense:delete'), async (req: AppRequest, res, next) => {
  try {
    await ExpensesService.delete(req, req.params.id);
    res.json({
      success: true,
      data: { message: 'Expense deleted successfully.' },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
