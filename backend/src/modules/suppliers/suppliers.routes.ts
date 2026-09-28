import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { AuditService } from '../audit/audit.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  taxNumber: z.string().optional(),
  address: z.string().optional(),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('supplier:manage'), async (req: AppRequest, res, next) => {
  try {
    const suppliers = await db('suppliers')
      .where({ business_id: req.user!.businessId, is_active: true })
      .orderBy('name', 'asc');
    res.json({
      success: true,
      data: suppliers,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('supplier:manage'), async (req: AppRequest, res, next) => {
  try {
    const input = supplierSchema.parse(req.body);
    const [supplier] = await db('suppliers').insert({
      business_id: req.user!.businessId,
      name: input.name,
      contact_person: input.contactPerson || null,
      phone: input.phone || null,
      email: input.email || null,
      tax_number: input.taxNumber || null,
      address: input.address || null,
      outstanding_balance: 0.00,
      is_active: true,
    }).returning('*');

    await AuditService.logRequest(req, 'SUPPLIER_CREATED', 'suppliers', supplier.id, { name: supplier.name });

    res.status(201).json({
      success: true,
      data: supplier,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('supplier:manage'), async (req: AppRequest, res, next) => {
  try {
    const input = supplierSchema.partial().parse(req.body);
    const [updated] = await db('suppliers')
      .where({ id: req.params.id, business_id: req.user!.businessId })
      .update({
        name: input.name,
        contact_person: input.contactPerson,
        phone: input.phone,
        email: input.email,
        tax_number: input.taxNumber,
        address: input.address,
        updated_at: new Date(),
      })
      .returning('*');

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

router.delete('/:id', requirePermission('supplier:manage'), async (req: AppRequest, res, next) => {
  try {
    await db('suppliers')
      .where({ id: req.params.id, business_id: req.user!.businessId })
      .update({ is_active: false, updated_at: new Date() });

    await AuditService.logRequest(req, 'SUPPLIER_DELETED', 'suppliers', req.params.id);

    res.json({
      success: true,
      data: { message: 'Supplier deleted successfully.' },
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
