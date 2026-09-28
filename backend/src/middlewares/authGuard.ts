import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppRequest } from '../types/index.js';
import { config } from '../config/index.js';
import { db } from '../database/index.js';

interface JwtPayload {
  userId: string;
  businessId: string;
  email: string;
}

export async function authGuard(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Check Cookie if header is absent (for PWA)
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').map((c: string) => c.trim());
      const tokenCookie = cookies.find((c: string) => c.startsWith('access_token='));
      if (tokenCookie) {
        token = decodeURIComponent(tokenCookie.substring('access_token='.length));
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is missing.',
        },
        requestId: req.id,
      });
      return;
    }

    // Verify JWT
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    } catch (err: any) {
      const isExpired = err.name === 'TokenExpiredError';
      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          message: isExpired ? 'Access token has expired.' : 'Access token is invalid.',
        },
        requestId: req.id,
      });
      return;
    }

    // Load User and Permissions from Database
    const user = await db('users')
      .where({ id: decoded.userId, business_id: decoded.businessId })
      .first();

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account does not exist or has been disabled.',
        },
        requestId: req.id,
      });
      return;
    }

    if (user.is_locked) {
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is locked until ${new Date(user.locked_until).toISOString()}.`,
          },
          requestId: req.id,
        });
        return;
      }
    }

    // Fetch user roles
    const userRoles = await db('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', user.id)
      .select('roles.name');

    const roleNames = userRoles.map((r: { name: string }) => r.name);

    // Fetch granular permissions
    const permissions = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .join('roles', 'role_permissions.role_id', 'roles.id')
      .join('user_roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .distinct('permissions.name')
      .select('permissions.name');

    const permissionNames = permissions.map((p: { name: string }) => p.name);

    req.user = {
      id: user.id,
      businessId: user.business_id,
      email: user.email,
      fullName: user.full_name,
      roles: roleNames,
      permissions: permissionNames,
      defaultLocationId: user.default_location_id,
    };

    next();
  } catch (error) {
    console.error('[AUTH GUARD ERROR]', error);
    res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'AUTH_FAILED',
        message: 'An internal authentication error occurred.',
      },
      requestId: req.id,
    });
  }
}
