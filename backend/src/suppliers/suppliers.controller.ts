import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
class SupplierDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() taxNumber?: string;
}
@Controller('suppliers')
@UseGuards(AuthGuard, PermissionGuard)
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('purchases.manage') list(@Req() request: Request) {
    return this.prisma.supplier.findMany({ where: { tenantId: request.tenantId!, isActive: true }, orderBy: { name: 'asc' } });
  }
  @Post() @RequirePermission('purchases.manage') create(@Body() dto: SupplierDto, @Req() request: Request) {
    return this.prisma.supplier.create({ data: { ...dto, tenantId: request.tenantId! } });
  }
  @Get(':id') @RequirePermission('purchases.manage') get(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.supplier.findFirstOrThrow({ where: { id, tenantId: request.tenantId! }, include: { purchases: true } });
  }
  @Patch(':id') @RequirePermission('purchases.manage') update(
    @Param('id') id: string,
    @Body() dto: Partial<SupplierDto>, @Req() request: Request,
  ) {
    return this.prisma.supplier.updateMany({ where: { id, tenantId: request.tenantId! }, data: dto });
  }
  @Post(':id/deactivate') @RequirePermission('purchases.manage') deactivate(
    @Param('id') id: string, @Req() request: Request,
  ) {
    return this.prisma.supplier.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: false } });
  }
}
