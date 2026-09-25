import { calculateStockChange, InsufficientStockError } from '../src/common/domain/stock';

describe('stock changes', () => {
  it('returns the new quantity for a valid movement', () => {
    expect(calculateStockChange(10, -2, 'Milk')).toBe(8);
  });
  it('rejects a movement that would create negative stock', () => {
    expect(() => calculateStockChange(1, -2, 'Milk')).toThrow(InsufficientStockError);
  });
});
