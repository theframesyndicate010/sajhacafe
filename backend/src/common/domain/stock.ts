export class InsufficientStockError extends Error {
  constructor(item: string, requested: number, available: number) {
    super(`Insufficient stock for ${item}: requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export function calculateStockChange(current: number, delta: number, itemName: string): number {
  const next = current + delta;

  if (next < 0) {
    throw new InsufficientStockError(itemName, Math.abs(delta), current);
  }

  return Math.round((next + Number.EPSILON) * 1000) / 1000;
}
