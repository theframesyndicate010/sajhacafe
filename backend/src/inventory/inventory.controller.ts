import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { InventoryItemDto, StockMovementDto, UpdateInventoryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(AuthGuard, PermissionGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission('inventory.read')
  list(@Req() request: Request) {
    return this.inventory.list(request.tenantId!);
  }

  @Get('low-stock')
  @RequirePermission('inventory.read')
  lowStock(@Req() request: Request) {
    return this.inventory.lowStock(request.tenantId!);
  }

  @Post()
  @RequirePermission('inventory.adjust')
  create(@Body() dto: InventoryItemDto, @Req() request: Request) {
    return this.inventory.create(dto, request);
  }

  @Patch(':id')
  @RequirePermission('inventory.adjust')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto, @Req() request: Request) {
    return this.inventory.update(id, dto, request.tenantId!);
  }

  @Delete(':id')
  @RequirePermission('inventory.adjust')
  deactivate(@Param('id') id: string, @Req() request: Request) {
    return this.inventory.deactivate(id, request.tenantId!);
  }

  @Get(':id/movements')
  @RequirePermission('inventory.read')
  movements(@Param('id') id: string, @Req() request: Request) {
    return this.inventory.movements(id, request.tenantId!);
  }

  @Post(':id/adjust')
  @RequirePermission('inventory.adjust')
  adjust(@Param('id') id: string, @Body() dto: StockMovementDto, @Req() request: Request) {
    return this.inventory.adjust(id, dto, request);
  }

  @Post(':id/waste')
  @RequirePermission('inventory.adjust')
  waste(@Param('id') id: string, @Body() dto: StockMovementDto, @Req() request: Request) {
    return this.inventory.waste(id, dto, request);
  }
}
