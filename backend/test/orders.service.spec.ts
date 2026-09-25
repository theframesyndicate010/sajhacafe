import { Prisma } from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/common/prisma.service';
import { Request } from 'express';

describe('OrdersService', () => {
  it('uses the active tenant menu price and persists that price on the order item', async () => {
    const menuItem = { id: 'menu-a', name: 'Chicken Burger', price: new Prisma.Decimal('325.75') };
    const tx = {
      menuItem: { findMany: jest.fn().mockResolvedValue([menuItem]) },
      restaurantTable: { findFirst: jest.fn().mockResolvedValue({ id: 'table-a' }) },
      order: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersService(prisma as unknown as PrismaService);
    const request = { tenantId: 'tenant-a', userId: 'waiter-a' } as Request;

    const result = await service.create({
      orderType: 'DINE_IN',
      tableId: 'table-a',
      items: [{ menuItemId: 'menu-a', quantity: 2 }],
    }, request);

    expect(tx.menuItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a', isActive: true }) }));
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a', createdBy: 'waiter-a', subtotal: 651.5, totalAmount: 651.5, items: { create: [expect.objectContaining({ menuItemId: 'menu-a', itemName: 'Chicken Burger', unitPrice: 325.75, totalAmount: 651.5 })] } }) }));
    expect(result).toBeDefined();
  });
});
