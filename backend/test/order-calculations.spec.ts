import { calculateOrderTotals } from '../src/common/domain/order-calculations';

describe('calculateOrderTotals', () => {
  it('calculates subtotal, discount, tax, and total using decimal-safe rounding', () => {
    expect(
      calculateOrderTotals({
        items: [
          { quantity: 2, unitPrice: 250 },
          { quantity: 1, unitPrice: 180 },
        ],
        discountAmount: 50,
        taxEnabled: true,
        taxRate: 13,
      }),
    ).toEqual({ subtotal: 680, discountAmount: 50, taxAmount: 81.9, totalAmount: 711.9 });
  });

  it('does not allow a discount to make the total negative', () => {
    expect(
      calculateOrderTotals({ items: [{ quantity: 1, unitPrice: 100 }], discountAmount: 150 }),
    ).toEqual({ subtotal: 100, discountAmount: 100, taxAmount: 0, totalAmount: 0 });
  });
});
