import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InventoryItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  minimumQuantity!: number;

  @IsNumber()
  @Min(0)
  costPrice!: number;
}

export class StockMovementDto {
  @IsNumber()
  quantity!: number;

  @IsString()
  reason!: string;
}
