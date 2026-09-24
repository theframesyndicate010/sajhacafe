import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { calculateStockChange } from '../common/domain/stock';
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

  create(dto: InventoryItemDto, tenantId: string) {
    return this.prisma.inventoryItem.create({ data: { ...dto, tenantId } });
  }

  update(id: string, dto: Partial<InventoryItemDto>, tenantId: string) {
    return this.prisma.inventoryItem.updateMany({ where: { id, tenantId }, data: dto });
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
    if (!reason.trim()) throw new BadRequestException('Reason is required');

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirstOrThrow({ where: { id, tenantId } });
      const next = calculateStockChange(Number(item.currentQuantity), quantity, item.name);

      await tx.inventoryItem.updateMany({
        where: { id, tenantId },
        data: { currentQuantity: next },
      });

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
