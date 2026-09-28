import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { hashPassword } from '../../utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';

export interface CreateUserInput {
  email: string;
  phone?: string;
  fullName: string;
  password: string;
  roleName: string;
  defaultLocationId?: string;
}

export class UsersService {
  public static async listUsers(businessId: string) {
    const users = await db('users')
      .where({ business_id: businessId })
      .select('id', 'email', 'phone', 'full_name', 'is_active', 'is_locked', 'last_login_at', 'created_at')
      .orderBy('created_at', 'desc');

    for (const u of users) {
      const roles = await db('user_roles')
        .join('roles', 'user_roles.role_id', 'roles.id')
        .where('user_roles.user_id', u.id)
        .select('roles.name');
      (u as any).roles = roles.map((r) => r.name);
    }

    return users;
  }

  public static async createUser(req: AppRequest, input: CreateUserInput) {
    const existing = await db('users').where({ email: input.email }).first();
    if (existing) {
      throw { status: 400, code: 'EMAIL_EXISTS', message: 'User with this email already exists.' };
    }

    const role = await db('roles').where({ name: input.roleName }).first();
    if (!role) {
      throw { status: 400, code: 'INVALID_ROLE', message: `Role ${input.roleName} is not recognized.` };
    }

    const passwordHash = await hashPassword(input.password);

    return await db.transaction(async (trx) => {
      const [user] = await trx('users').insert({
        business_id: req.user!.businessId,
        default_location_id: input.defaultLocationId || null,
        email: input.email,
        phone: input.phone || null,
        full_name: input.fullName,
        password_hash: passwordHash,
        is_active: true,
      }).returning(['id', 'email', 'full_name', 'phone', 'is_active', 'created_at']);

      await trx('user_roles').insert({
        user_id: user.id,
        role_id: role.id,
      });

      await AuditService.logRequest(req, 'USER_CREATED', 'users', user.id, {
        email: user.email,
        role: input.roleName,
      });

      return {
        ...user,
        roles: [input.roleName],
      };
    });
  }

  public static async listRoles() {
    return await db('roles').select('id', 'name', 'description');
  }

  public static async listPermissions() {
    return await db('permissions').select('id', 'name', 'category', 'description').orderBy('category', 'asc');
  }
}
