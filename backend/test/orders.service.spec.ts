import { Prisma } from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/common/prisma.service';
import { Request } from 'express';

describe('OrdersService', () => {
  function setup(openBill: { id: string } | null) {
    const menuItem = { id: 'menu-a', name: 'Chicken Burger', price: new Prisma.Decimal('325.75') };
    const tx = {
      menuItem: { findMany: jest.fn().mockResolvedValue([menuItem]) },
      restaurantTable: { findFirst: jest.fn().mockResolvedValue({ id: 'table-a' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      bill: {
        findFirst: jest.fn().mockResolvedValue(openBill),
        create: jest.fn().mockResolvedValue({ id: 'bill-new' }),
        update: jest.fn().mockResolvedValue(openBill),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersService(prisma as unknown as PrismaService);
    const request = { tenantId: 'tenant-a', userId: 'waiter-a' } as Request;
    return { tx, service, request };
  }

  it('creates a bill for a table and persists current menu prices on its order items', async () => {
    const { tx, service, request } = setup(null);
    const result = await service.create({
      orderType: 'DINE_IN',
      tableId: 'table-a',
      items: [{ menuItemId: 'menu-a', quantity: 2 }],
    }, request);

    expect(tx.menuItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a', isActive: true }) }));
    expect(tx.bill.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant-a', tableId: 'table-a', status: 'OPEN' } });
    expect(tx.restaurantTable.updateMany).toHaveBeenCalledWith({ where: { id: 'table-a', tenantId: 'tenant-a' }, data: { status: 'OCCUPIED' } });
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a', billId: 'bill-new', createdBy: 'waiter-a', subtotal: 651.5, totalAmount: 651.5, items: { create: [expect.objectContaining({ menuItemId: 'menu-a', itemName: 'Chicken Burger', unitPrice: 325.75, totalAmount: 651.5 })] } }) }));
  });

  it('reuses the open bill for later orders at the same table and clears its printed timestamp', async () => {
    const existingBill = { id: 'bill-open' };
    const { tx, service, request } = setup(existingBill);
    await service.create({ orderType: 'DINE_IN', tableId: 'table-a', items: [{ menuItemId: 'menu-a', quantity: 1 }] }, request);

    expect(tx.bill.create).not.toHaveBeenCalled();
    expect(tx.bill.update).toHaveBeenCalledWith({ where: { id: 'bill-open' }, data: { printedAt: null } });
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ billId: 'bill-open' }) }));
  });
});
