import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { AuditService } from '../audit/audit.service.js';

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

export class CustomersService {
  public static async list(businessId: string, query: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseQuery = db('customers')
      .where({ business_id: businessId, is_active: true });

    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      baseQuery = baseQuery.where((builder) => {
        builder.whereRaw('LOWER(name) LIKE ?', [term])
          .orWhere('phone', 'like', term)
          .orWhereRaw('LOWER(email) LIKE ?', [term]);
      });
    }

    const countRes = await baseQuery.clone().count<{ count: string }>('id as count').first();
    const total = Number(countRes?.count || 0);

    const customers = await baseQuery
      .select('*')
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      items: customers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getById(businessId: string, id: string) {
    const customer = await db('customers')
      .where({ id, business_id: businessId, is_active: true })
      .first();
    if (!customer) {
      throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' };
    }
    return customer;
  }

  public static async create(req: AppRequest, input: CustomerInput) {
    const [customer] = await db('customers').insert({
      business_id: req.user!.businessId,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      tax_number: input.taxNumber || null,
      address: input.address || null,
      city: input.city || null,
      postal_code: input.postalCode || null,
      outstanding_balance: 0.00,
      is_active: true,
    }).returning('*');

    await AuditService.logRequest(req, 'CUSTOMER_CREATED', 'customers', customer.id, { name: customer.name });
    return customer;
  }

  public static async update(req: AppRequest, id: string, input: Partial<CustomerInput>) {
    await this.getById(req.user!.businessId, id);

    const [updated] = await db('customers')
      .where({ id, business_id: req.user!.businessId })
      .update({
        name: input.name,
        phone: input.phone,
        email: input.email,
        tax_number: input.taxNumber,
        address: input.address,
        city: input.city,
        postal_code: input.postalCode,
        updated_at: new Date(),
      })
      .returning('*');

    await AuditService.logRequest(req, 'CUSTOMER_UPDATED', 'customers', id, { input });
    return updated;
  }

  public static async delete(req: AppRequest, id: string) {
    await this.getById(req.user!.businessId, id);

    // Soft delete customer
    await db('customers')
      .where({ id, business_id: req.user!.businessId })
      .update({ is_active: false, updated_at: new Date() });

    await AuditService.logRequest(req, 'CUSTOMER_DELETED', 'customers', id);
    return true;
  }
}
