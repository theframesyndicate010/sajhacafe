import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { BillsService } from './bills.service';

class PrintedBillDto {
  @IsDateString() updatedAt!: string;
}

@Controller('bills')
@UseGuards(AuthGuard, PermissionGuard)
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Get()
  @RequirePermission('orders.read')
  list(@Req() request: Request) {
    return this.bills.list(request.tenantId!);
  }

  @Get(':id')
  @RequirePermission('orders.read')
  get(@Param('id') id: string, @Req() request: Request) {
    return this.bills.get(id, request.tenantId!);
  }

  @Post(':id/printed')
  @RequirePermission('bills.print')
  markPrinted(@Param('id') id: string, @Body() dto: PrintedBillDto, @Req() request: Request) {
    return this.bills.markPrinted(id, request.tenantId!, dto.updatedAt);
  }
}
