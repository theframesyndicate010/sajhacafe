import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseDto } from './dto/purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.purchase.findMany({
      where: { tenantId }, include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getById(id: string, tenantId: string) {
    return this.prisma.purchase.findFirstOrThrow({
      where: { id, tenantId },
      include: { supplier: true, items: true },
    });
  }

  async create(dto: CreatePurchaseDto, request: Request) {
    if (!dto.items.length) throw new BadRequestException('Purchase requires items');
    const tenantId = request.tenantId!;
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId, isActive: true } });
    if (!supplier) throw new BadRequestException('Supplier is inactive or missing');
    const inventoryIds = [...new Set(dto.items.map((item) => item.inventoryItemId))];
    const inventoryCount = await this.prisma.inventoryItem.count({ where: { id: { in: inventoryIds }, tenantId, isActive: true } });
    if (inventoryCount !== inventoryIds.length) throw new BadRequestException('Purchase references an inactive or missing inventory item');

    const items = dto.items.map((item) => ({
      ...item,
      totalCost: item.quantity * item.unitCost,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.totalCost, 0);

    return this.prisma.purchase.create({
      data: {
        tenantId, purchaseNumber: BigInt(Date.now()),
        supplierId: dto.supplierId,
        createdBy: request.userId!,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        notes: dto.notes,
        items: { create: items.map((item) => ({ ...item, tenantId })) },
      },
      include: { items: true },
    });
  }

  update(id: string, notes: string | undefined, tenantId: string) {
    return this.prisma.purchase.updateMany({ where: { id, tenantId }, data: { notes } });
  }

  complete(id: string, request: Request) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({
        where: { id, tenantId: request.tenantId! },
        include: { items: true },
      });
      if (purchase.status !== 'DRAFT') throw new BadRequestException('Purchase is not a draft');

      for (const line of purchase.items) {
        const item = await tx.inventoryItem.findFirstOrThrow({
          where: { id: line.inventoryItemId, tenantId: request.tenantId! },
        });
        const next = Number(item.currentQuantity) + Number(line.quantity);

        await tx.inventoryItem.updateMany({
          where: { id: item.id, tenantId: request.tenantId! },
          data: { currentQuantity: next, costPrice: line.unitCost },
        });
        await tx.stockMovement.create({
          data: {
            tenantId: request.tenantId!, inventoryItemId: item.id,
            type: 'PURCHASE',
            quantity: line.quantity,
            previousQuantity: item.currentQuantity,
            newQuantity: next,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            createdBy: request.userId!,
          },
        });
      }

      return tx.purchase.updateMany({ where: { id, tenantId: request.tenantId! }, data: { status: 'COMPLETED' } });
    });
  }

  cancel(id: string, tenantId: string) {
    return this.prisma.purchase.updateMany({ where: { id, tenantId }, data: { status: 'CANCELLED' } });
  }
}
