import { PaymentsService } from '../src/payments/payments.service';
import { PrismaService } from '../src/common/prisma.service';
import { RecipeInventoryService } from '../src/inventory/recipe-inventory.service';
import { Request } from 'express';

describe('PaymentsService bill lifecycle', () => {
  it('closes the open table bill and releases the table after all its orders are paid', async () => {
    const tx = {
      order: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'order-1', billId: 'bill-1', totalAmount: 100 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      },
      bill: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ tableId: 'table-1' })
          .mockResolvedValueOnce({ id: 'bill-1', tableId: 'table-1', orders: [{ totalAmount: 100, payments: [{ amount: 100 }] }] }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      restaurantTable: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const inventory = { deductForOrder: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(prisma as unknown as PrismaService, inventory as unknown as RecipeInventoryService);

    await service.create('order-1', { method: 'CASH', amount: 100 }, { tenantId: 'tenant-1', userId: 'cashier-1', headers: {} } as Request);

    expect(tx.bill.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bill-1', tenantId: 'tenant-1', status: 'OPEN' }, data: expect.objectContaining({ status: 'CLOSED' }) }));
    expect(tx.restaurantTable.updateMany).toHaveBeenCalledWith({ where: { id: 'table-1', tenantId: 'tenant-1', status: 'OCCUPIED' }, data: { status: 'AVAILABLE' } });
  });
});
