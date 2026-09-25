import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class RecipeInventoryService {
  async deductForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId, tenantId },
      include: { items: true },
    });
    const requirements = new Map<string, number>();
    for (const item of order.items) {
      const menuItem = await tx.menuItem.findFirst({
        where: { id: item.menuItemId, tenantId, isActive: true },
        select: { inventoryItemId: true },
      });
      if (menuItem?.inventoryItemId) {
        requirements.set(
          menuItem.inventoryItemId,
          (requirements.get(menuItem.inventoryItemId) ?? 0) + Number(item.quantity),
        );
        continue;
      }
      const recipes = await tx.recipe.findMany({
        where: { tenantId, menuItemId: item.menuItemId, isActive: true },
        include: { items: true },
      });
      // A menu item without a direct inventory link or recipe is not stock-tracked.
      // It should still be sellable; only configured inventory requirements are deducted.
      if (!recipes.length) continue;
      for (const recipeItem of recipes[0].items)
        requirements.set(
          recipeItem.inventoryItemId,
          (requirements.get(recipeItem.inventoryItemId) ?? 0) +
            Number(recipeItem.quantity) * Number(item.quantity),
        );
    }
    for (const [inventoryItemId, quantity] of requirements) {
      const [item] = await tx.$queryRaw<Array<{ id: string; name: string; currentQuantity: Prisma.Decimal }>>`
        SELECT id, name, currentQuantity FROM InventoryItem
        WHERE id = ${inventoryItemId} AND tenantId = ${tenantId} FOR UPDATE`;
      if (!item) throw new BadRequestException('Inventory item was not found in the active cafe');
      const next = Number(item.currentQuantity) - quantity;
      if (next < 0) throw new BadRequestException(`Insufficient stock for ${item.name}`);
      await tx.inventoryItem.update({ where: { id: item.id }, data: { currentQuantity: next } });
      await tx.stockMovement.create({
        data: {
          tenantId, inventoryItemId: item.id,
          type: 'SALE',
          quantity: -quantity,
          previousQuantity: item.currentQuantity,
          newQuantity: next,
          referenceType: 'ORDER',
          referenceId: orderId,
          reason: 'Recipe deduction',
          createdBy: userId,
        },
      });
    }
  }
}
