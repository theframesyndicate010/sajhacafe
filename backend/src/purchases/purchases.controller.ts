import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { CreatePurchaseDto } from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(AuthGuard, PermissionGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @RequirePermission('purchases.manage')
  list(@Req() request: Request) {
    return this.purchases.list(request.tenantId!);
  }

  @Get(':id')
  @RequirePermission('purchases.manage')
  get(@Param('id') id: string, @Req() request: Request) {
    return this.purchases.getById(id, request.tenantId!);
  }

  @Post()
  @RequirePermission('purchases.manage')
  create(@Body() dto: CreatePurchaseDto, @Req() request: Request) {
    return this.purchases.create(dto, request);
  }

  @Patch(':id')
  @RequirePermission('purchases.manage')
  update(@Param('id') id: string, @Body('notes') notes: string | undefined, @Req() request: Request) {
    return this.purchases.update(id, notes, request.tenantId!);
  }

  @Post(':id/complete')
  @RequirePermission('purchases.manage')
  complete(@Param('id') id: string, @Req() request: Request) {
    return this.purchases.complete(id, request);
  }

  @Post(':id/cancel')
  @RequirePermission('purchases.manage')
  cancel(@Param('id') id: string, @Req() request: Request) {
    return this.purchases.cancel(id, request.tenantId!);
  }
}
