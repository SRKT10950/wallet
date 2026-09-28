import { Response, NextFunction } from 'express';
import { AppRequest } from '../types/index.js';

export function requirePermission(...requiredPermissions: string[]) {
  return (req: AppRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication is required.',
        },
        requestId: req.id,
      });
      return;
    }

    // OWNER has absolute bypass
    if (req.user.roles.includes('OWNER')) {
      return next();
    }

    // Check if user has ALL required permissions or at least one depending on configuration
    const hasAll = requiredPermissions.every((perm) => req.user!.permissions.includes(perm));

    if (!hasAll) {
      res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied. Required: ${requiredPermissions.join(', ')}`,
        },
        requestId: req.id,
      });
      return;
    }

    next();
  };
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AppRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication is required.',
        },
        requestId: req.id,
      });
      return;
    }

    if (req.user.roles.includes('OWNER')) {
      return next();
    }

    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `Role restricted. Allowed roles: ${allowedRoles.join(', ')}`,
        },
        requestId: req.id,
      });
      return;
    }

    next();
  };
}
