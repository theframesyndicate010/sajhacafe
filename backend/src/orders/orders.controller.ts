import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { CreateOrderDto, OrderItemDto, UpdateOrderStatusDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard, PermissionGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission('orders.read')
  list(@Query('status') status: OrderStatus | undefined, @Req() request: Request) {
    return this.orders.list(status, request.tenantId!);
  }

  @Get(':id')
  @RequirePermission('orders.read')
  get(@Param('id') id: string, @Req() request: Request) {
    return this.orders.getById(id, request.tenantId!);
  }

  @Post()
  @RequirePermission('orders.create')
  create(@Body() dto: CreateOrderDto, @Req() request: Request) {
    return this.orders.create(dto, request);
  }

  @Patch(':id/status')
  @RequirePermission('orders.update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() request: Request) {
    return this.orders.updateStatus(id, dto.status, request.tenantId!);
  }

  @Post(':id/send-to-kitchen')
  @RequirePermission('orders.send_to_kitchen')
  sendToKitchen(@Param('id') id: string, @Req() request: Request) {
    return this.orders.sendToKitchen(id, request.tenantId!);
  }

  @Post(':id/cancel')
  @RequirePermission('orders.cancel')
  cancel(@Param('id') id: string, @Body('reason') reason: string, @Req() request: Request) {
    return this.orders.cancel(id, reason, request);
  }

  @Post(':id/items')
  @RequirePermission('orders.update')
  addItem(@Param('id') id: string, @Body() dto: OrderItemDto, @Req() request: Request) {
    return this.orders.addItem(id, dto, request.tenantId!);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission('orders.update')
  updateItem(@Param('itemId') itemId: string, @Body() dto: Partial<OrderItemDto>, @Req() request: Request) {
    return this.orders.updateItem(itemId, dto, request.tenantId!);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('orders.update')
  removeItem(@Param('itemId') itemId: string, @Req() request: Request) {
    return this.orders.removeItem(itemId, request.tenantId!);
  }
}
