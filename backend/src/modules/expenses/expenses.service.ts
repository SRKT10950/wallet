import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { roundMoney } from '../../utils/money.js';
import { AuditService } from '../audit/audit.service.js';

export interface CreateExpenseInput {
  categoryId: string;
  locationId?: string;
  expenseDate?: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  description: string;
  notes?: string;
}

export class ExpensesService {
  public static async create(req: AppRequest, input: CreateExpenseInput) {
    const businessId = req.user!.businessId;
    const locationId = input.locationId || req.locationId || req.user?.defaultLocationId;
    const amount = roundMoney(input.amount);

    if (amount <= 0) {
      throw { status: 400, code: 'INVALID_AMOUNT', message: 'Expense amount must be greater than zero.' };
    }

    const business = await db('businesses').where({ id: businessId }).first();

    const [expense] = await db('expenses').insert({
      business_id: businessId,
      location_id: locationId,
      category_id: input.categoryId,
      created_by_user_id: req.user!.id,
      expense_date: input.expenseDate || new Date().toISOString().split('T')[0],
      amount,
      currency: business?.currency || 'USD',
      payment_method: input.paymentMethod || 'CASH',
      reference: input.reference || null,
      description: input.description,
      notes: input.notes || null,
    }).returning('*');

    await AuditService.logRequest(req, 'EXPENSE_CREATED', 'expenses', expense.id, {
      amount,
      categoryId: input.categoryId,
      description: input.description,
    });

    return expense;
  }

  public static async list(businessId: string, query: {
    page?: number;
    limit?: number;
    categoryId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseQuery = db('expenses')
      .join('expense_categories', 'expenses.category_id', 'expense_categories.id')
      .leftJoin('locations', 'expenses.location_id', 'locations.id')
      .leftJoin('users', 'expenses.created_by_user_id', 'users.id')
      .where('expenses.business_id', businessId);

    if (query.categoryId) {
      baseQuery = baseQuery.where('expenses.category_id', query.categoryId);
    }
    if (query.locationId) {
      baseQuery = baseQuery.where('expenses.location_id', query.locationId);
    }
    if (query.startDate) {
      baseQuery = baseQuery.where('expenses.expense_date', '>=', query.startDate);
    }
    if (query.endDate) {
      baseQuery = baseQuery.where('expenses.expense_date', '<=', query.endDate);
    }
    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      baseQuery = baseQuery.where((b) => {
        b.whereRaw('LOWER(expenses.description) LIKE ?', [term])
          .orWhereRaw('LOWER(expense_categories.name) LIKE ?', [term]);
      });
    }

    const countRes = await baseQuery.clone().count<{ count: string }>('expenses.id as count').first();
    const total = Number(countRes?.count || 0);

    const expenses = await baseQuery
      .select(
        'expenses.*',
        'expense_categories.name as category_name',
        'locations.name as location_name',
        'users.full_name as created_by_name'
      )
      .orderBy('expenses.expense_date', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      items: expenses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getById(businessId: string, id: string) {
    const expense = await db('expenses')
      .join('expense_categories', 'expenses.category_id', 'expense_categories.id')
      .leftJoin('locations', 'expenses.location_id', 'locations.id')
      .where({ 'expenses.id': id, 'expenses.business_id': businessId })
      .select('expenses.*', 'expense_categories.name as category_name', 'locations.name as location_name')
      .first();

    if (!expense) {
      throw { status: 404, code: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' };
    }
    return expense;
  }

  public static async update(req: AppRequest, id: string, input: Partial<CreateExpenseInput>) {
    await this.getById(req.user!.businessId, id);

    const [updated] = await db('expenses')
      .where({ id, business_id: req.user!.businessId })
      .update({
        category_id: input.categoryId,
        location_id: input.locationId,
        expense_date: input.expenseDate,
        amount: input.amount ? roundMoney(input.amount) : undefined,
        payment_method: input.paymentMethod,
        reference: input.reference,
        description: input.description,
        notes: input.notes,
        updated_at: new Date(),
      })
      .returning('*');

    await AuditService.logRequest(req, 'EXPENSE_UPDATED', 'expenses', id, { input });
    return updated;
  }

  public static async delete(req: AppRequest, id: string) {
    await this.getById(req.user!.businessId, id);

    await db('expenses')
      .where({ id, business_id: req.user!.businessId })
      .delete();

    await AuditService.logRequest(req, 'EXPENSE_DELETED', 'expenses', id);
    return true;
  }

  /**
   * Daily, weekly, monthly summaries
   */
  public static async getSummary(businessId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const now = new Date();
    let startDate: string;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate = new Date(now.setDate(diff)).toISOString().split('T')[0];
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    const totalRes = await db('expenses')
      .where('business_id', businessId)
      .where('expense_date', '>=', startDate)
      .sum<{ total: string }>('amount as total')
      .first();

    const categoryBreakdown = (await db('expenses')
      .join('expense_categories', 'expenses.category_id', 'expense_categories.id')
      .where('expenses.business_id', businessId)
      .where('expenses.expense_date', '>=', startDate)
      .groupBy('expense_categories.name')
      .select('expense_categories.name as category')
      .sum('expenses.amount as total')) as Array<{ category: string; total: string | number }>;

    return {
      period,
      startDate,
      totalAmount: Number(totalRes?.total || 0),
      byCategory: categoryBreakdown.map((c) => ({
        category: c.category,
        total: Number(c.total || 0),
      })),
    };
  }

  public static async listCategories(businessId: string) {
    return await db('expense_categories')
      .where({ business_id: businessId })
      .orderBy('name', 'asc');
  }

  public static async createCategory(businessId: string, name: string, description?: string) {
    const [cat] = await db('expense_categories').insert({
      business_id: businessId,
      name,
      description: description || null,
    }).returning('*');
    return cat;
  }
}
