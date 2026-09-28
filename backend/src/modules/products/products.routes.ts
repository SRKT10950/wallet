import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { ProductsService } from './products.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.string().uuid().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.coerce.number().min(0, 'Cost price must be non-negative'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be non-negative'),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  unit: z.string().optional().default('unit'),
  stockQuantity: z.coerce.number().optional().default(0),
  lowStockThreshold: z.coerce.number().optional().default(5),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    const result = await ProductsService.list(req.user!.businessId, req.query);
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

router.get('/categories', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    const categories = await ProductsService.listCategories(req.user!.businessId);
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

router.post('/categories', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) throw { status: 400, message: 'Category name is required' };
    const cat = await ProductsService.createCategory(req.user!.businessId, name, description);
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

router.get('/:id', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    const product = await ProductsService.getById(req.user!.businessId, req.params.id);
    res.json({
      success: true,
      data: product,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    const input = productSchema.parse(req.body);
    const created = await ProductsService.create(req, input);
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

router.put('/:id', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    const input = productSchema.partial().parse(req.body);
    const updated = await ProductsService.update(req, req.params.id, input);
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

router.delete('/:id', requirePermission('product:manage'), async (req: AppRequest, res, next) => {
  try {
    await ProductsService.delete(req, req.params.id);
    res.json({
      success: true,
      data: { message: 'Product deactivated successfully.' },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
