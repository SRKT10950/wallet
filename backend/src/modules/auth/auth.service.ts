import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../database/index.js';
import { config } from '../../config/index.js';
import { verifyPassword, generateRandomToken, hashKey } from '../../utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';
import { AppRequest } from '../../types/index.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export class AuthService {
  /**
   * User login with credential validation, lockout protection, and token generation
   */
  public static async login(req: AppRequest, identifier: string, password: string) {
    const user = await db('users')
      .where('email', identifier)
      .orWhere('phone', identifier)
      .first();

    if (!user) {
      await AuditService.logRequest(req, 'LOGIN_FAILED', 'users', null, { identifier, reason: 'USER_NOT_FOUND' }, false);
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email/phone or password.' };
    }

    if (!user.is_active) {
      await AuditService.logRequest(req, 'LOGIN_FAILED', 'users', user.id, { reason: 'USER_INACTIVE' }, false);
      throw { status: 401, code: 'ACCOUNT_DISABLED', message: 'This account has been disabled.' };
    }

    if (user.is_locked && user.locked_until && new Date(user.locked_until) > new Date()) {
      await AuditService.logRequest(req, 'LOGIN_FAILED', 'users', user.id, { reason: 'ACCOUNT_LOCKED' }, false);
      throw {
        status: 403,
        code: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked due to multiple failed login attempts until ${new Date(user.locked_until).toISOString()}.`,
      };
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const isNowLocked = attempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = isNowLocked ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

      await db('users').where({ id: user.id }).update({
        failed_login_attempts: attempts,
        is_locked: isNowLocked,
        locked_until: lockedUntil,
      });

      await AuditService.logRequest(
        req,
        'LOGIN_FAILED',
        'users',
        user.id,
        { reason: 'INVALID_PASSWORD', attempts, isLocked: isNowLocked },
        false
      );

      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email/phone or password.' };
    }

    // Reset failed login attempts on successful authentication
    await db('users').where({ id: user.id }).update({
      failed_login_attempts: 0,
      is_locked: false,
      locked_until: null,
      last_login_at: new Date(),
    });

    // Create session
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const [session] = await db('sessions').insert({
      user_id: user.id,
      device_id: req.device?.deviceId || null,
      ip_address: req.clientIp,
      user_agent: (req.headers['user-agent'] as string) || null,
      is_active: true,
      expires_at: sessionExpiresAt,
    }).returning('*');

    // Create Access Token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        businessId: user.business_id,
        email: user.email,
        sessionId: session.id,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    // Create Refresh Token
    const rawRefreshToken = generateRandomToken(48);
    const refreshTokenHash = hashKey(rawRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').insert({
      user_id: user.id,
      session_id: session.id,
      token_hash: refreshTokenHash,
      is_revoked: false,
      expires_at: refreshExpiresAt,
    });

    // Fetch user roles and permissions
    const userRoles = await db('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', user.id)
      .select('roles.name');

    const permissions = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .join('roles', 'role_permissions.role_id', 'roles.id')
      .join('user_roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .distinct('permissions.name')
      .select('permissions.name');

    // Fetch business and location info
    const business = await db('businesses').where({ id: user.business_id }).first();
    const location = await db('locations').where({ id: req.locationId || user.default_location_id }).first();

    await AuditService.logRequest(req, 'LOGIN_SUCCESS', 'users', user.id, {
      email: user.email,
      sessionId: session.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.full_name,
        roles: userRoles.map((r) => r.name),
        permissions: permissions.map((p) => p.name),
      },
      business: {
        id: business.id,
        name: business.name,
        currency: business.currency,
      },
      location: location ? {
        id: location.id,
        code: location.code,
        name: location.name,
      } : null,
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: config.JWT_EXPIRES_IN,
      },
    };
  }

  /**
   * Refreshes access token with rotation of refresh token
   */
  public static async refresh(req: AppRequest, refreshToken: string) {
    if (!refreshToken) {
      throw { status: 400, code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token must be provided.' };
    }

    const tokenHash = hashKey(refreshToken);
    const storedToken = await db('refresh_tokens')
      .where({ token_hash: tokenHash })
      .first();

    if (!storedToken || storedToken.is_revoked || new Date(storedToken.expires_at) < new Date()) {
      throw { status: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is expired, revoked, or invalid.' };
    }

    const user = await db('users').where({ id: storedToken.user_id, is_active: true }).first();
    if (!user) {
      throw { status: 401, code: 'USER_INACTIVE', message: 'User is no longer active.' };
    }

    // Revoke old refresh token (Token Rotation)
    await db('refresh_tokens').where({ id: storedToken.id }).update({ is_revoked: true });

    // Generate new refresh token
    const newRawRefreshToken = generateRandomToken(48);
    const newRefreshTokenHash = hashKey(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').insert({
      user_id: user.id,
      session_id: storedToken.session_id,
      token_hash: newRefreshTokenHash,
      is_revoked: false,
      expires_at: newExpiresAt,
    });

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        businessId: user.business_id,
        email: user.email,
        sessionId: storedToken.session_id,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: config.JWT_EXPIRES_IN,
    };
  }

  /**
   * Logout user by invalidating the refresh token and session
   */
  public static async logout(req: AppRequest, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = hashKey(refreshToken);
      await db('refresh_tokens').where({ token_hash: tokenHash }).update({ is_revoked: true });
    }

    if (req.user?.id) {
      await AuditService.logRequest(req, 'LOGOUT', 'users', req.user.id);
    }

    return true;
  }
}
