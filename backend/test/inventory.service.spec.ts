import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/common/prisma.service';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('InventoryService', () => {
  it('allocates an SKU and saves opening quantity with its movement atomically', async () => {
    const createdItem = { id: 'item-id', sku: 'INV-000042', currentQuantity: 50 };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ value: 42n }]),
      inventoryItem: { create: jest.fn().mockResolvedValue(createdItem) },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-id' }) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new InventoryService(prisma as unknown as PrismaService);
    const request = { tenantId: 'tenant-a', userId: 'user-a' } as Request;

    const result = await service.create({ name: 'Chicken Burger', unit: 'pcs', minimumQuantity: 10, costPrice: 80, initialQuantity: 50 }, request);

    expect(result).toBe(createdItem);
    expect(tx.inventoryItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: 'tenant-a', sku: 'INV-000042', currentQuantity: 50 }) });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: 'tenant-a', inventoryItemId: 'item-id', quantity: 50, previousQuantity: 0, newQuantity: 50, createdBy: 'user-a' }) });
  });

  it('rejects a stock removal that would put inventory below zero', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'item-id', name: 'Chicken Burger', currentQuantity: new Prisma.Decimal('2') }]),
      inventoryItem: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new InventoryService(prisma as unknown as PrismaService);
    const request = { tenantId: 'tenant-a', userId: 'user-a' } as Request;

    await expect(service.adjust('item-id', { quantity: -3, reason: 'Waste' }, request)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
