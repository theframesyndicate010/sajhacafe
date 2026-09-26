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

  it('records a part payment as PARTIALLY_PAID and leaves the bill and table open', async () => {
    const tx = {
      order: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'order-1', billId: 'bill-1', totalAmount: 120 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      },
      bill: { findFirst: jest.fn(), updateMany: jest.fn() },
      restaurantTable: { updateMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const inventory = { deductForOrder: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(prisma as unknown as PrismaService, inventory as unknown as RecipeInventoryService);

    await service.create('order-1', { method: 'CASH', amount: 100 }, { tenantId: 'tenant-1', userId: 'cashier-1', headers: {} } as Request);

    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ orderId: 'order-1', amount: 100 }) }));
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { paymentStatus: 'PARTIALLY_PAID' } }));
    // Still 20 outstanding, so the bill must stay open and stock must not be deducted.
    expect(tx.bill.updateMany).not.toHaveBeenCalled();
    expect(tx.restaurantTable.updateMany).not.toHaveBeenCalled();
    expect(inventory.deductForOrder).not.toHaveBeenCalled();
  });

  it('settles the remaining balance of a part-paid order and releases the table', async () => {
    const tx = {
      order: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'order-1', billId: 'bill-1', totalAmount: 120 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100 } }),
        create: jest.fn().mockResolvedValue({ id: 'payment-2' }),
      },
      bill: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ tableId: 'table-1' })
          .mockResolvedValueOnce({ id: 'bill-1', tableId: 'table-1', orders: [{ totalAmount: 120, payments: [{ amount: 100 }, { amount: 20 }] }] }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      restaurantTable: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const inventory = { deductForOrder: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(prisma as unknown as PrismaService, inventory as unknown as RecipeInventoryService);

    await service.create('order-1', { method: 'CASH', amount: 20 }, { tenantId: 'tenant-1', userId: 'cashier-1', headers: {} } as Request);

    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { paymentStatus: 'PAID' } }));
    expect(tx.bill.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED' }) }));
    expect(inventory.deductForOrder).toHaveBeenCalled();
  });

  it('rejects a part payment that is larger than the outstanding balance', async () => {
    const tx = {
      order: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'order-1', billId: 'bill-1', totalAmount: 120 }),
        updateMany: jest.fn(),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100 } }),
        create: jest.fn(),
      },
      bill: { findFirst: jest.fn(), updateMany: jest.fn() },
      restaurantTable: { updateMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const inventory = { deductForOrder: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(prisma as unknown as PrismaService, inventory as unknown as RecipeInventoryService);

    await expect(
      service.create('order-1', { method: 'CASH', amount: 30 }, { tenantId: 'tenant-1', userId: 'cashier-1', headers: {} } as Request),
    ).rejects.toThrow('Payment exceeds balance');
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
