import { db } from '../../database/index.js';
import { AppRequest } from '../../types/index.js';
import { roundMoney } from '../../utils/money.js';
import { AuditService } from '../audit/audit.service.js';

export interface RecordPaymentInput {
  invoiceId?: string;
  customerId?: string;
  locationId?: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  paymentDate?: string;
  notes?: string;
}

export class PaymentsService {
  public static async recordPayment(req: AppRequest, input: RecordPaymentInput) {
    const businessId = req.user!.businessId;
    const locationId = input.locationId || req.locationId || req.user?.defaultLocationId;
    const paymentAmount = roundMoney(input.amount);

    if (paymentAmount <= 0) {
      throw { status: 400, code: 'INVALID_AMOUNT', message: 'Payment amount must be greater than zero.' };
    }

    return await db.transaction(async (trx) => {
      let customerId = input.customerId;

      // If tied to an invoice, validate and update invoice
      if (input.invoiceId) {
        const invoice = await trx('invoices')
          .where({ id: input.invoiceId, business_id: businessId })
          .forUpdate()
          .first();

        if (!invoice) {
          throw { status: 404, code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' };
        }

        if (invoice.is_cancelled) {
          throw { status: 400, code: 'INVOICE_CANCELLED', message: 'Cannot record payment for a cancelled invoice.' };
        }

        const newAmountPaid = roundMoney(Number(invoice.amount_paid) + paymentAmount);
        const newBalanceDue = roundMoney(Number(invoice.grand_total) - newAmountPaid);
        const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await trx('invoices')
          .where({ id: input.invoiceId })
          .update({
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, newBalanceDue),
            payment_status: newStatus,
            updated_at: new Date(),
          });

        if (!customerId && invoice.customer_id) {
          customerId = invoice.customer_id;
        }
      }

      // Generate payment number
      const paymentNumber = `PAY-${Date.now().toString().slice(-8)}`;

      const [payment] = await trx('payments').insert({
        business_id: businessId,
        location_id: locationId,
        invoice_id: input.invoiceId || null,
        customer_id: customerId || null,
        created_by_user_id: req.user!.id,
        payment_number: paymentNumber,
        amount: paymentAmount,
        payment_method: input.paymentMethod,
        reference_number: input.referenceNumber || null,
        payment_date: input.paymentDate || new Date().toISOString().split('T')[0],
        notes: input.notes || null,
      }).returning('*');

      // Adjust customer balance
      if (customerId) {
        await trx('customers')
          .where({ id: customerId, business_id: businessId })
          .decrement('outstanding_balance', paymentAmount);
      }

      await AuditService.logRequest(req, 'PAYMENT_CREATED', 'payments', payment.id, {
        paymentNumber,
        amount: paymentAmount,
        invoiceId: input.invoiceId,
        customerId,
      });

      return payment;
    });
  }

  public static async list(businessId: string, query: {
    page?: number;
    limit?: number;
    invoiceId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseQuery = db('payments')
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .leftJoin('customers', 'payments.customer_id', 'customers.id')
      .leftJoin('users', 'payments.created_by_user_id', 'users.id')
      .where('payments.business_id', businessId);

    if (query.invoiceId) {
      baseQuery = baseQuery.where('payments.invoice_id', query.invoiceId);
    }
    if (query.customerId) {
      baseQuery = baseQuery.where('payments.customer_id', query.customerId);
    }
    if (query.startDate) {
      baseQuery = baseQuery.where('payments.payment_date', '>=', query.startDate);
    }
    if (query.endDate) {
      baseQuery = baseQuery.where('payments.payment_date', '<=', query.endDate);
    }

    const countRes = await baseQuery.clone().count<{ count: string }>('payments.id as count').first();
    const total = Number(countRes?.count || 0);

    const payments = await baseQuery
      .select(
        'payments.*',
        'invoices.invoice_number',
        'customers.name as customer_name',
        'users.full_name as received_by_name'
      )
      .orderBy('payments.payment_date', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      items: payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
