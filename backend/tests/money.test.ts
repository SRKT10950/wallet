import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  roundMoney,
  calculateInvoiceTotals,
} from '../src/utils/money.js';

describe('Financial Math Precision', () => {
  it('correctly converts floating values to integer minor units without floating-point artifacts', () => {
    // 0.1 + 0.2 in standard JS floats is 0.30000000000000004
    const cents1 = toMinorUnits(0.1);
    const cents2 = toMinorUnits(0.2);
    expect(cents1 + cents2).toBe(30n);
    expect(fromMinorUnits(cents1 + cents2)).toBe('0.30');

    expect(toMinorUnits(19.99)).toBe(1999n);
    expect(fromMinorUnits(1999n)).toBe('19.99');
    expect(toMinorUnits('1250.50')).toBe(125050n);
    expect(fromMinorUnits(125050n)).toBe('1250.50');
  });

  it('correctly calculates multi-item invoice with line taxes and discounts', () => {
    const items = [
      {
        quantity: 2,
        unitPrice: 100.0,
        discountRate: 10, // 10% line discount -> $180
        taxRate: 5, // 5% line tax on $180 -> $9.00 -> line total $189.00
      },
      {
        quantity: 1,
        unitPrice: 50.0,
        discountRate: 0,
        taxRate: 10, // 10% line tax -> $5.00 -> line total $55.00
      },
    ];

    const result = calculateInvoiceTotals(items, 10, 100);

    // Subtotal: 200 + 50 = 250.00
    expect(result.subtotal).toBe(250.0);
    // Line discounts: 20.00 + Overall discount: 10.00 = 30.00
    expect(result.discountAmount).toBe(30.0);
    // Taxes: 9.00 + 5.00 = 14.00
    expect(result.taxAmount).toBe(14.0);
    // Grand Total: (250 - 30) + 14 = 234.00
    expect(result.grandTotal).toBe(234.0);
    // Balance Due: 234.00 - 100.00 paid = 134.00
    expect(result.balanceDue).toBe(134.0);

    expect(result.itemsCalculated[0].lineTotal).toBe(189.0);
    expect(result.itemsCalculated[1].lineTotal).toBe(55.0);
  });

  it('marks paid in full when amountPaid matches grand total', () => {
    const items = [{ quantity: 3, unitPrice: 10, discountRate: 0, taxRate: 0 }];
    const result = calculateInvoiceTotals(items, 0, 30);
    expect(result.grandTotal).toBe(30);
    expect(result.balanceDue).toBe(0);
  });
});
