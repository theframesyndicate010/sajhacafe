import { Prisma } from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/common/prisma.service';
import { Request } from 'express';

describe('OrdersService', () => {
  function setup(openBill: { id: string } | null, menuItems?: Array<Record<string, unknown>>) {
    const items = menuItems ?? [{ id: 'menu-a', name: 'Chicken Burger', price: new Prisma.Decimal('325.75'), isExternal: false }];
    const tx = {
      // Mirrors the real query, which only returns the ids the order asked for.
      menuItem: { findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) => Promise.resolve(items.filter((item) => where.id.in.includes(item.id as string)))) },
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

  describe('counter items that are not on the menu', () => {
    const externalMenu = [
      { id: 'menu-a', name: 'Chicken Burger', price: new Prisma.Decimal('325.75'), isExternal: false },
      { id: 'menu-ext', name: 'External Item', price: new Prisma.Decimal('0'), isExternal: true },
    ];

    it('prices an external line from the name and amount typed at the POS', async () => {
      const { tx, service, request } = setup(null, externalMenu);
      await service.create({
        orderType: 'DINE_IN',
        tableId: 'table-a',
        items: [{ menuItemId: 'menu-ext', quantity: 2, itemName: 'Local cake slice', unitPrice: 180 }],
      }, request);

      expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 360,
          items: { create: [expect.objectContaining({ menuItemId: 'menu-ext', itemName: 'Local cake slice', unitPrice: 180, totalAmount: 360 })] },
        }),
      }));
    });

    it('keeps two different external lines separate on one order', async () => {
      const { tx, service, request } = setup(null, externalMenu);
      await service.create({
        orderType: 'DINE_IN',
        tableId: 'table-a',
        items: [
          { menuItemId: 'menu-ext', quantity: 1, itemName: 'Extra sauce', unitPrice: 30 },
          { menuItemId: 'menu-ext', quantity: 1, itemName: 'Packaging box', unitPrice: 45 },
        ],
      }, request);

      const created = tx.order.create.mock.calls[0][0].data.items.create;
      expect(created).toHaveLength(2);
      expect(created[0]).toEqual(expect.objectContaining({ itemName: 'Extra sauce', unitPrice: 30 }));
      expect(created[1]).toEqual(expect.objectContaining({ itemName: 'Packaging box', unitPrice: 45 }));
      expect(tx.order.create.mock.calls[0][0].data.totalAmount).toBe(75);
    });

    it('refuses to let a client reprice a real menu item', async () => {
      const { service, request } = setup(null, externalMenu);
      await expect(service.create({
        orderType: 'DINE_IN',
        tableId: 'table-a',
        items: [{ menuItemId: 'menu-a', quantity: 1, unitPrice: 1 }],
      }, request)).rejects.toThrow(/cannot be repriced/);
    });

    it('rejects an external line with no price or no name', async () => {
      const { service, request } = setup(null, externalMenu);
      await expect(service.create({
        orderType: 'DINE_IN',
        tableId: 'table-a',
        items: [{ menuItemId: 'menu-ext', quantity: 1, itemName: 'Extra sauce' }],
      }, request)).rejects.toThrow(/price greater than zero/);

      await expect(service.create({
        orderType: 'DINE_IN',
        tableId: 'table-a',
        items: [{ menuItemId: 'menu-ext', quantity: 1, unitPrice: 50 }],
      }, request)).rejects.toThrow(/needs an item name/);
    });
  });
});
