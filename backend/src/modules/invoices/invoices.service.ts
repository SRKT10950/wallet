import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { calculateInvoiceTotals, roundMoney } from '../../utils/money.js';
import { AuditService } from '../audit/audit.service.js';
import { generateInvoicePdf } from './invoices.pdf.js';

export interface CreateInvoiceItemInput {
  productId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
}

export interface CreateInvoiceInput {
  customerId?: string;
  locationId?: string;
  invoiceDate?: string;
  dueDate?: string;
  items: CreateInvoiceItemInput[];
  overallDiscountAmount?: number;
  initialAmountPaid?: number;
  paymentMethod?: string;
  notes?: string;
  terms?: string;
}

export class InvoicesService {
  /**
   * Generates a collision-free sequential invoice number within a transaction
   */
  private static async generateInvoiceNumber(trx: any, businessId: string): Promise<string> {
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Lock the sequence row or count invoices in transaction
    const latest = await trx('invoices')
      .where('business_id', businessId)
      .where('invoice_number', 'like', `${prefix}-%`)
      .orderBy('invoice_number', 'desc')
      .forUpdate()
      .first();

    let seq = 1;
    if (latest && latest.invoice_number) {
      const parts = latest.invoice_number.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  /**
   * Create invoice with server-side validation and calculations
   */
  public static async create(req: AppRequest, input: CreateInvoiceInput) {
    if (!input.items || input.items.length === 0) {
      throw { status: 400, code: 'EMPTY_INVOICE', message: 'Invoice must contain at least one line item.' };
    }

    const businessId = req.user!.businessId;
    const locationId = input.locationId || req.locationId || req.user?.defaultLocationId;
    if (!locationId) {
      throw { status: 400, code: 'LOCATION_REQUIRED', message: 'Location ID is required.' };
    }

    const business = await db('businesses').where({ id: businessId }).first();
    const initialPaid = roundMoney(input.initialAmountPaid || 0);

    // Perform deterministic server-side calculations
    const calc = calculateInvoiceTotals(
      input.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountRate: i.discountRate || 0,
        taxRate: i.taxRate || 0,
      })),
      input.overallDiscountAmount || 0,
      initialPaid
    );

    let paymentStatus = 'UNPAID';
    if (calc.balanceDue <= 0 && calc.grandTotal > 0) {
      paymentStatus = 'PAID';
    } else if (initialPaid > 0 && calc.balanceDue > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    return await db.transaction(async (trx) => {
      const invoiceNumber = await this.generateInvoiceNumber(trx, businessId);

      const [invoice] = await trx('invoices').insert({
        business_id: businessId,
        location_id: locationId,
        customer_id: input.customerId || null,
        created_by_user_id: req.user!.id,
        invoice_number: invoiceNumber,
        invoice_date: input.invoiceDate || new Date().toISOString().split('T')[0],
        due_date: input.dueDate || null,
        payment_status: paymentStatus,
        subtotal: calc.subtotal,
        discount_amount: calc.discountAmount,
        tax_amount: calc.taxAmount,
        grandTotal: calc.grandTotal,
        amount_paid: initialPaid,
        balance_due: calc.balanceDue,
        currency: business?.currency || 'USD',
        notes: input.notes || null,
        terms: input.terms || null,
      }).returning('*');

      // Insert line items and adjust inventory
      for (let i = 0; i < input.items.length; i++) {
        const itemInput = input.items[i];
        const calculatedItem = calc.itemsCalculated[i];

        await trx('invoice_items').insert({
          invoice_id: invoice.id,
          product_id: itemInput.productId || null,
          item_name: itemInput.itemName,
          quantity: itemInput.quantity,
          unit_price: itemInput.unitPrice,
          discount_rate: itemInput.discountRate || 0.00,
          tax_rate: itemInput.taxRate || 0.00,
          line_subtotal: calculatedItem.lineSubtotal,
          line_total: calculatedItem.lineTotal,
        });

        // Decrement product inventory if linked
        if (itemInput.productId) {
          await trx('products')
            .where({ id: itemInput.productId, business_id: businessId })
            .decrement('stock_quantity', itemInput.quantity);
        }
      }

      // If initial payment was made, record payment entry
      if (initialPaid > 0) {
        const paymentNumber = `PAY-${Date.now().toString().slice(-8)}`;
        await trx('payments').insert({
          business_id: businessId,
          location_id: locationId,
          invoice_id: invoice.id,
          customer_id: input.customerId || null,
          created_by_user_id: req.user!.id,
          payment_number: paymentNumber,
          amount: initialPaid,
          payment_method: input.paymentMethod || 'CASH',
          payment_date: invoice.invoice_date,
          notes: 'Initial payment upon invoice creation',
        });
      }

      // Update customer outstanding balance if customer selected
      if (input.customerId && calc.balanceDue > 0) {
        await trx('customers')
          .where({ id: input.customerId, business_id: businessId })
          .increment('outstanding_balance', calc.balanceDue);
      }

      await AuditService.logRequest(req, 'INVOICE_CREATED', 'invoices', invoice.id, {
        invoiceNumber,
        grandTotal: calc.grandTotal,
        paymentStatus,
        customerId: input.customerId,
      });

      return invoice;
    });
  }

  /**
   * List invoices with filters, pagination, and customer info
   */
  public static async list(businessId: string, query: {
    page?: number;
    limit?: number;
    customerId?: string;
    locationId?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseQuery = db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .leftJoin('locations', 'invoices.location_id', 'locations.id')
      .where('invoices.business_id', businessId);

    if (query.paymentStatus) {
      baseQuery = baseQuery.where('invoices.payment_status', query.paymentStatus);
    }
    if (query.customerId) {
      baseQuery = baseQuery.where('invoices.customer_id', query.customerId);
    }
    if (query.locationId) {
      baseQuery = baseQuery.where('invoices.location_id', query.locationId);
    }
    if (query.startDate) {
      baseQuery = baseQuery.where('invoices.invoice_date', '>=', query.startDate);
    }
    if (query.endDate) {
      baseQuery = baseQuery.where('invoices.invoice_date', '<=', query.endDate);
    }
    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      baseQuery = baseQuery.where((b) => {
        b.whereRaw('LOWER(invoices.invoice_number) LIKE ?', [term])
          .orWhereRaw('LOWER(customers.name) LIKE ?', [term]);
      });
    }

    const countRes = await baseQuery.clone().count<{ count: string }>('invoices.id as count').first();
    const total = Number(countRes?.count || 0);

    const invoices = await baseQuery
      .select(
        'invoices.*',
        'customers.name as customer_name',
        'customers.phone as customer_phone',
        'locations.name as location_name'
      )
      .orderBy('invoices.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      items: invoices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by ID with items and payments
   */
  public static async getById(businessId: string, id: string) {
    const invoice = await db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .leftJoin('locations', 'invoices.location_id', 'locations.id')
      .leftJoin('users', 'invoices.created_by_user_id', 'users.id')
      .where({ 'invoices.id': id, 'invoices.business_id': businessId })
      .select(
        'invoices.*',
        'customers.name as customer_name',
        'customers.phone as customer_phone',
        'customers.email as customer_email',
        'customers.address as customer_address',
        'customers.tax_number as customer_tax_number',
        'locations.name as location_name',
        'users.full_name as created_by_name'
      )
      .first();

    if (!invoice) {
      throw { status: 404, code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' };
    }

    const items = await db('invoice_items')
      .leftJoin('products', 'invoice_items.product_id', 'products.id')
      .where({ invoice_id: id })
      .select(
        'invoice_items.*',
        'products.sku as product_sku'
      );

    const payments = await db('payments')
      .leftJoin('users', 'payments.created_by_user_id', 'users.id')
      .where({ invoice_id: id })
      .select('payments.*', 'users.full_name as received_by_name')
      .orderBy('payment_date', 'desc');

    return {
      ...invoice,
      items,
      payments,
    };
  }

  /**
   * Cancel invoice
   */
  public static async cancel(req: AppRequest, id: string, reason?: string) {
    const invoice = await this.getById(req.user!.businessId, id);
    if (invoice.is_cancelled) {
      throw { status: 400, code: 'ALREADY_CANCELLED', message: 'Invoice is already cancelled.' };
    }

    return await db.transaction(async (trx) => {
      await trx('invoices')
        .where({ id })
        .update({
          is_cancelled: true,
          payment_status: 'CANCELLED',
          cancelled_at: new Date(),
          cancelled_by_user_id: req.user!.id,
          notes: invoice.notes ? `${invoice.notes} | Cancelled: ${reason || 'No reason'}` : `Cancelled: ${reason || 'No reason'}`,
          updated_at: new Date(),
        });

      // Revert customer balance if unpaid balance was charged
      if (invoice.customer_id && invoice.balance_due > 0) {
        await trx('customers')
          .where({ id: invoice.customer_id, business_id: req.user!.businessId })
          .decrement('outstanding_balance', invoice.balance_due);
      }

      // Restock inventory
      for (const item of invoice.items) {
        if (item.product_id) {
          await trx('products')
            .where({ id: item.product_id, business_id: req.user!.businessId })
            .increment('stock_quantity', item.quantity);
        }
      }

      await AuditService.logRequest(req, 'INVOICE_CANCELLED', 'invoices', id, {
        invoiceNumber: invoice.invoice_number,
        reason,
      });

      return true;
    });
  }

  /**
   * Render PDF buffer for invoice
   */
  public static async getPdfBuffer(businessId: string, id: string): Promise<Buffer> {
    const invoice = await this.getById(businessId, id);
    const business = await db('businesses').where({ id: businessId }).first();

    return await generateInvoicePdf({
      business: {
        name: business.name,
        legalName: business.legal_name,
        taxId: business.tax_id,
        phone: business.phone,
        email: business.email,
        address: business.address,
        currency: business.currency,
      },
      invoice: {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        paymentStatus: invoice.payment_status,
        subtotal: Number(invoice.subtotal),
        discountAmount: Number(invoice.discount_amount),
        taxAmount: Number(invoice.tax_amount),
        grandTotal: Number(invoice.grand_total),
        amountPaid: Number(invoice.amount_paid),
        balanceDue: Number(invoice.balance_due),
        currency: invoice.currency,
        notes: invoice.notes,
        terms: invoice.terms,
      },
      customer: invoice.customer_id ? {
        name: invoice.customer_name,
        phone: invoice.customer_phone,
        email: invoice.customer_email,
        address: invoice.customer_address,
        taxNumber: invoice.customer_tax_number,
      } : undefined,
      items: invoice.items.map((i: any) => ({
        itemName: i.item_name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        discountRate: Number(i.discount_rate),
        taxRate: Number(i.tax_rate),
        lineSubtotal: Number(i.line_subtotal),
        lineTotal: Number(i.line_total),
      })),
    });
  }
}
