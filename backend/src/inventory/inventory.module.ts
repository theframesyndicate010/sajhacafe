import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { RecipeInventoryService } from './recipe-inventory.service';
import { InventoryService } from './inventory.service';
@Module({
  controllers: [InventoryController],
  providers: [InventoryService, RecipeInventoryService],
  exports: [InventoryService, RecipeInventoryService],
})
export class InventoryModule {}
