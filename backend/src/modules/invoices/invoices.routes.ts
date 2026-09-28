import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { InvoicesService } from './invoices.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const emptyToUndefined = (v: any) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const createInvoiceSchema = z.object({
  customerId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  locationId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  invoiceDate: z.string().optional(),
  dueDate: z.preprocess(emptyToUndefined, z.string().optional()),
  overallDiscountAmount: z.coerce.number().min(0).optional().default(0),
  initialAmountPaid: z.coerce.number().min(0).optional().default(0),
  paymentMethod: z.string().optional().default('CASH'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
      itemName: z.string().min(1, 'Item name is required'),
      quantity: z.coerce.number().positive('Quantity must be greater than zero'),
      unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
      discountRate: z.coerce.number().min(0).max(100).optional().default(0),
      taxRate: z.coerce.number().min(0).max(100).optional().default(0),
    })
  ).min(1, 'Invoice must have at least one line item'),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('invoice:read'), async (req: AppRequest, res, next) => {
  try {
    const result = await InvoicesService.list(req.user!.businessId, req.query);
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

router.get('/:id', requirePermission('invoice:read'), async (req: AppRequest, res, next) => {
  try {
    const invoice = await InvoicesService.getById(req.user!.businessId, req.params.id);
    res.json({
      success: true,
      data: invoice,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('invoice:create'), async (req: AppRequest, res, next) => {
  try {
    const input = createInvoiceSchema.parse(req.body);
    const invoice = await InvoicesService.create(req, input);
    res.status(201).json({
      success: true,
      data: invoice,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requirePermission('invoice:delete'), async (req: AppRequest, res, next) => {
  try {
    const { reason } = req.body || {};
    await InvoicesService.cancel(req, req.params.id, reason);
    res.json({
      success: true,
      data: { message: 'Invoice cancelled successfully.' },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/invoices/:id/pdf
 * Downloads/streams generated PDF invoice
 */
router.get('/:id/pdf', requirePermission('invoice:pdf'), async (req: AppRequest, res, next) => {
  try {
    const pdfBuffer = await InvoicesService.getPdfBuffer(req.user!.businessId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
