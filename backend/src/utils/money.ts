/**
 * Utility for exact financial arithmetic to avoid floating-point errors.
 * Internally works with integer minor units (e.g. cents) or exact scaled arithmetic.
 */

export function toMinorUnits(amount: number | string): bigint {
  const numStr = typeof amount === 'number' ? amount.toFixed(2) : amount;
  const [whole, decimal = ''] = numStr.split('.');
  const paddedDecimal = (decimal + '00').slice(0, 2);
  const cleanStr = `${whole}${paddedDecimal}`.replace(/^-?0+/, '') || '0';
  const isNegative = numStr.trim().startsWith('-');
  const value = BigInt(cleanStr);
  return isNegative ? -value : value;
}

export function fromMinorUnits(minorUnits: bigint): string {
  const isNegative = minorUnits < 0n;
  const abs = isNegative ? -minorUnits : minorUnits;
  const str = abs.toString().padStart(3, '0');
  const whole = str.slice(0, -2);
  const decimal = str.slice(-2);
  return `${isNegative ? '-' : ''}${whole}.${decimal}`;
}

export function roundMoney(amount: number | string): number {
  return Number(Number(amount).toFixed(2));
}

export function formatMoney(amount: number | string, currency: string = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

export interface InvoiceCalculations {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  balanceDue: number;
}

export interface InvoiceItemInput {
  quantity: number;
  unitPrice: number;
  discountRate?: number; // e.g. 5 for 5%
  taxRate?: number; // e.g. 10 for 10%
}

/**
 * Deterministically computes invoice totals
 */
export function calculateInvoiceTotals(
  items: InvoiceItemInput[],
  overallDiscountAmount: number = 0,
  amountPaid: number = 0
): InvoiceCalculations & { itemsCalculated: Array<InvoiceItemInput & { lineSubtotal: number; lineTotal: number; discountAmount: number; taxAmount: number }> } {
  let subtotalCents = 0n;
  let taxCents = 0n;
  let lineDiscountCents = 0n;

  const itemsCalculated = items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const discRate = Number(item.discountRate) || 0;
    const taxRate = Number(item.taxRate) || 0;

    const lineRaw = roundMoney(qty * price);
    const lineDiscount = roundMoney((lineRaw * discRate) / 100);
    const lineAfterDiscount = roundMoney(lineRaw - lineDiscount);
    const lineTax = roundMoney((lineAfterDiscount * taxRate) / 100);
    const lineTotal = roundMoney(lineAfterDiscount + lineTax);

    subtotalCents += toMinorUnits(lineRaw);
    lineDiscountCents += toMinorUnits(lineDiscount);
    taxCents += toMinorUnits(lineTax);

    return {
      ...item,
      lineSubtotal: lineRaw,
      discountAmount: lineDiscount,
      taxAmount: lineTax,
      lineTotal: lineTotal,
    };
  });

  const totalDiscountCents = lineDiscountCents + toMinorUnits(overallDiscountAmount);
  const subtotalAfterDiscountCents = subtotalCents - totalDiscountCents;
  const grandTotalCents = subtotalAfterDiscountCents + taxCents;
  const amountPaidCents = toMinorUnits(amountPaid);
  const balanceDueCents = grandTotalCents - amountPaidCents;

  return {
    subtotal: Number(fromMinorUnits(subtotalCents)),
    discountAmount: Number(fromMinorUnits(totalDiscountCents)),
    taxAmount: Number(fromMinorUnits(taxCents)),
    grandTotal: Number(fromMinorUnits(grandTotalCents)),
    balanceDue: Number(fromMinorUnits(balanceDueCents)),
    itemsCalculated,
  };
}
