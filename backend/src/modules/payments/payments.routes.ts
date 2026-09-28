import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { PaymentsService } from './payments.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER']),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('payment:read'), async (req: AppRequest, res, next) => {
  try {
    const result = await PaymentsService.list(req.user!.businessId, req.query);
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

router.post('/', requirePermission('payment:create'), async (req: AppRequest, res, next) => {
  try {
    const input = recordPaymentSchema.parse(req.body);
    const payment = await PaymentsService.recordPayment(req, input);
    res.status(201).json({
      success: true,
      data: payment,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
