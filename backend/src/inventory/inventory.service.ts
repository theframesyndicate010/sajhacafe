import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { calculateStockChange, InsufficientStockError } from '../common/domain/stock';
import { InventoryItemDto, StockMovementDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async lowStock(tenantId: string) {
    const items = await this.prisma.inventoryItem.findMany({ where: { tenantId, isActive: true } });
    return items.filter((item) => Number(item.currentQuantity) <= Number(item.minimumQuantity));
  }

  async create(dto: InventoryItemDto, request: Request) {
    const { initialQuantity = 0, sku, ...fields } = dto;
    const tenantId = request.tenantId!;
    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('"InventorySkuSequence"') AS value`;
      const generatedSku = `INV-${sequence[0].value.toString().padStart(6, '0')}`;
      const item = await tx.inventoryItem.create({
        data: { ...fields, tenantId, sku: sku?.trim() || generatedSku, currentQuantity: initialQuantity },
      });
      if (initialQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            tenantId, inventoryItemId: item.id, type: 'ADJUSTMENT', quantity: initialQuantity,
            previousQuantity: 0, newQuantity: initialQuantity, reason: 'Opening stock', createdBy: request.userId!,
          },
        });
      }
      return item;
    });
  }

  async update(id: string, dto: Partial<InventoryItemDto>, tenantId: string) {
    const result = await this.prisma.inventoryItem.updateMany({ where: { id, tenantId }, data: dto });
    if (!result.count) throw new NotFoundException('Inventory item not found');
    return this.prisma.inventoryItem.findFirstOrThrow({ where: { id, tenantId } });
  }

  movements(id: string, tenantId: string) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId, inventoryItemId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  adjust(id: string, dto: StockMovementDto, request: Request) {
    return this.move(id, dto.quantity, 'ADJUSTMENT', dto.reason, request.userId!, request.tenantId!);
  }

  waste(id: string, dto: StockMovementDto, request: Request) {
    return this.move(id, -Math.abs(dto.quantity), 'WASTE', dto.reason, request.userId!, request.tenantId!);
  }

  private async move(
    id: string,
    quantity: number,
    type: 'ADJUSTMENT' | 'WASTE',
    reason: string,
    userId: string, tenantId: string,
  ) {
    if (!reason?.trim()) throw new BadRequestException('Reason is required');
    if (!Number.isFinite(quantity) || quantity === 0) throw new BadRequestException('Stock change must be a non-zero number');

    return this.prisma.$transaction(async (tx) => {
      const [item] = await tx.$queryRaw<Array<{ id: string; name: string; currentQuantity: Prisma.Decimal }>>`
        SELECT "id", "name", "currentQuantity" FROM "InventoryItem"
        WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      if (!item) throw new NotFoundException('Inventory item not found');
      let next: number;
      try {
        next = calculateStockChange(Number(item.currentQuantity), quantity, item.name);
      } catch (error) {
        if (error instanceof InsufficientStockError) throw new BadRequestException(error.message);
        throw error;
      }

      await tx.inventoryItem.update({ where: { id }, data: { currentQuantity: next } });

      return tx.stockMovement.create({
        data: {
          tenantId, inventoryItemId: id,
          type,
          quantity,
          previousQuantity: item.currentQuantity,
          newQuantity: next,
          reason,
          createdBy: userId,
        },
      });
    });
  }
}
