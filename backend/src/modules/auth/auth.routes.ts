import { Router } from 'express';
import { z } from 'zod';
import { AppRequest } from '../../types/index.js';
import { AuthService } from './auth.service.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { deviceSecurityGuard } from '../../middlewares/deviceSecurity.js';
import { config } from '../../config/index.js';

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/v1/auth/login
 * User login with device security headers
 */
router.post(
  '/login',
  deviceSecurityGuard(),
  async (req: AppRequest, res, next) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      const result = await AuthService.login(req, identifier, password);

      // Set HttpOnly cookie for PWA / Web clients if preferred
      res.cookie('access_token', result.tokens.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.json({
        success: true,
        data: result,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  deviceSecurityGuard(),
  async (req: AppRequest, res, next) => {
    try {
      const bodyToken = req.body?.refreshToken;
      const { refreshToken } = refreshSchema.parse({ refreshToken: bodyToken });
      const result = await AuthService.refresh(req, refreshToken);

      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.json({
        success: true,
        data: result,
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Invalidate session and tokens
 */
router.post(
  '/logout',
  deviceSecurityGuard(),
  authGuard,
  async (req: AppRequest, res, next) => {
    try {
      const refreshToken = req.body?.refreshToken;
      await AuthService.logout(req, refreshToken);

      res.clearCookie('access_token');

      res.json({
        success: true,
        data: { message: 'Logged out successfully.' },
        error: null,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Current user profile, business, and roles
 */
router.get(
  '/me',
  deviceSecurityGuard(),
  authGuard,
  async (req: AppRequest, res) => {
    res.json({
      success: true,
      data: {
        user: req.user,
        device: req.device,
        application: req.application,
        locationId: req.locationId,
      },
      error: null,
      requestId: req.id,
    });
  }
);

export default router;
