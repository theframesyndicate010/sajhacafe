export interface CalculationInput {
  items: Array<{ quantity: number; unitPrice: number }>;
  discountAmount?: number;
  taxEnabled?: boolean;
  taxRate?: number;
}

export interface CalculationResult {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateOrderTotals(input: CalculationInput): CalculationResult {
  const subtotal = money(
    input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const discountAmount = money(Math.min(Math.max(input.discountAmount ?? 0, 0), subtotal));
  const taxable = subtotal - discountAmount;
  const taxAmount = input.taxEnabled ? money(taxable * ((input.taxRate ?? 0) / 100)) : 0;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount: money(taxable + taxAmount),
  };
}
