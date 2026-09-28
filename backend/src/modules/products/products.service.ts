import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { AuditService } from '../audit/audit.service.js';

export interface ProductInput {
  name: string;
  categoryId?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  taxRate?: number;
  unit?: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

export class ProductsService {
  public static async list(businessId: string, query: { search?: string; categoryId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseQuery = db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .where({ 'products.business_id': businessId, 'products.is_active': true });

    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      baseQuery = baseQuery.where((builder) => {
        builder.whereRaw('LOWER(products.name) LIKE ?', [term])
          .orWhere('products.sku', 'like', term)
          .orWhere('products.barcode', 'like', term);
      });
    }

    if (query.categoryId) {
      baseQuery = baseQuery.where('products.category_id', query.categoryId);
    }

    const countRes = await baseQuery.clone().count<{ count: string }>('products.id as count').first();
    const total = Number(countRes?.count || 0);

    const products = await baseQuery
      .select(
        'products.*',
        'product_categories.name as category_name'
      )
      .orderBy('products.name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      items: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getById(businessId: string, id: string) {
    const product = await db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .where({ 'products.id': id, 'products.business_id': businessId, 'products.is_active': true })
      .select('products.*', 'product_categories.name as category_name')
      .first();

    if (!product) {
      throw { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' };
    }
    return product;
  }

  public static async create(req: AppRequest, input: ProductInput) {
    const [product] = await db('products').insert({
      business_id: req.user!.businessId,
      category_id: input.categoryId || null,
      name: input.name,
      sku: input.sku || null,
      barcode: input.barcode || null,
      description: input.description || null,
      cost_price: input.costPrice,
      selling_price: input.sellingPrice,
      tax_rate: input.taxRate || 0.00,
      unit: input.unit || 'unit',
      stock_quantity: input.stockQuantity || 0.00,
      low_stock_threshold: input.lowStockThreshold || 5.00,
      is_active: true,
    }).returning('*');

    await AuditService.logRequest(req, 'PRODUCT_CREATED', 'products', product.id, { name: product.name });
    return product;
  }

  public static async update(req: AppRequest, id: string, input: Partial<ProductInput>) {
    await this.getById(req.user!.businessId, id);

    const [updated] = await db('products')
      .where({ id, business_id: req.user!.businessId })
      .update({
        category_id: input.categoryId,
        name: input.name,
        sku: input.sku,
        barcode: input.barcode,
        description: input.description,
        cost_price: input.costPrice,
        selling_price: input.sellingPrice,
        tax_rate: input.taxRate,
        unit: input.unit,
        stock_quantity: input.stockQuantity,
        low_stock_threshold: input.lowStockThreshold,
        updated_at: new Date(),
      })
      .returning('*');

    await AuditService.logRequest(req, 'PRODUCT_UPDATED', 'products', id, { input });
    return updated;
  }

  public static async delete(req: AppRequest, id: string) {
    await this.getById(req.user!.businessId, id);

    await db('products')
      .where({ id, business_id: req.user!.businessId })
      .update({ is_active: false, updated_at: new Date() });

    await AuditService.logRequest(req, 'PRODUCT_DELETED', 'products', id);
    return true;
  }

  public static async listCategories(businessId: string) {
    return await db('product_categories')
      .where({ business_id: businessId })
      .orderBy('name', 'asc');
  }

  public static async createCategory(businessId: string, name: string, description?: string) {
    const [cat] = await db('product_categories').insert({
      business_id: businessId,
      name,
      description: description || null,
    }).returning('*');
    return cat;
  }
}
