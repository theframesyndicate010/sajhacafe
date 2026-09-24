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
      const recipes = await tx.recipe.findMany({
        where: { tenantId, menuItemId: item.menuItemId, isActive: true },
        include: { items: true },
      });
      if (!recipes.length)
        throw new BadRequestException(`No active recipe configured for ${item.itemName}`);
      for (const recipeItem of recipes[0].items)
        requirements.set(
          recipeItem.inventoryItemId,
          (requirements.get(recipeItem.inventoryItemId) ?? 0) +
            Number(recipeItem.quantity) * Number(item.quantity),
        );
    }
    for (const [inventoryItemId, quantity] of requirements) {
      const item = await tx.inventoryItem.findFirstOrThrow({ where: { id: inventoryItemId, tenantId } });
      const next = Number(item.currentQuantity) - quantity;
      if (next < 0) throw new BadRequestException(`Insufficient stock for ${item.name}`);
      await tx.inventoryItem.updateMany({ where: { id: item.id, tenantId }, data: { currentQuantity: next } });
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
