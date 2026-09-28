import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { UsersService } from './users.service.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { requirePermission } from '../../middlewares/rbacGuard.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  fullName: z.string().min(2),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  roleName: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']),
  defaultLocationId: z.string().uuid().optional(),
});

router.use(deviceSecurityGuard(), authGuard);

router.get('/', requirePermission('users:manage'), async (req: AppRequest, res, next) => {
  try {
    const users = await UsersService.listUsers(req.user!.businessId);
    res.json({
      success: true,
      data: users,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('users:manage'), async (req: AppRequest, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await UsersService.createUser(req, input);
    res.status(201).json({
      success: true,
      data: user,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/roles', async (req: AppRequest, res, next) => {
  try {
    const roles = await UsersService.listRoles();
    res.json({
      success: true,
      data: roles,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/permissions', requirePermission('users:manage'), async (req: AppRequest, res, next) => {
  try {
    const permissions = await UsersService.listPermissions();
    res.json({
      success: true,
      data: permissions,
      error: null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
