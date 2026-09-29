import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, OrderType } from '@prisma/client';

export class OrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  /// Only honoured for the tenant's flagged external item, which is the
  /// placeholder the POS uses for goods that are not in the menu. Regular
  /// menu items are always priced from MenuItem.price.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  itemName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  orderType!: OrderType;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  customerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
