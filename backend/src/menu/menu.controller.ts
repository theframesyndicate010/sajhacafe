import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';

class CategoryDto { @IsString() name!: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsNumber() displayOrder?: number; }
class MenuItemDto { @IsUUID() categoryId!: string; @IsString() name!: string; @IsOptional() @IsString() description?: string; @IsNumber() @Min(0) price!: number; @IsOptional() @IsUUID() inventoryItemId?: string; @IsOptional() @IsString() imageUrl?: string; }
class ActiveDto { @IsBoolean() isActive!: boolean; }

@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class MenuController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('categories') categories(@Req() request: Request, @Query('activeOnly') activeOnly?: string) {
    return this.prisma.category.findMany({ where: { tenantId: request.tenantId!, ...(activeOnly === 'true' ? { isActive: true } : {}) }, orderBy: { displayOrder: 'asc' } });
  }
  @Post('categories') @RequirePermission('menu.manage') createCategory(@Body() dto: CategoryDto, @Req() request: Request) {
    return this.prisma.category.create({ data: { ...dto, tenantId: request.tenantId! } });
  }
  @Patch('categories/:id') @RequirePermission('menu.manage') updateCategory(@Param('id') id: string, @Body() dto: CategoryDto, @Req() request: Request) {
    return this.prisma.category.updateMany({ where: { id, tenantId: request.tenantId! }, data: dto });
  }
  @Delete('categories/:id') @RequirePermission('menu.manage') deactivateCategory(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.category.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: false } });
  }
  @Get('menu-items') items(@Req() request: Request, @Query('categoryId') categoryId?: string, @Query('activeOnly') activeOnly?: string) {
    return this.prisma.menuItem.findMany({ where: { tenantId: request.tenantId!, ...(categoryId ? { categoryId } : {}), ...(activeOnly === 'true' ? { isActive: true, category: { is: { isActive: true } }, OR: [{ inventoryItemId: null }, { inventoryItem: { is: { isActive: true } } }] } : {}) }, include: { category: true }, orderBy: { name: 'asc' } });
  }
  @Post('menu-items') @RequirePermission('menu.manage') async createItem(@Body() dto: MenuItemDto, @Req() request: Request) {
    const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, tenantId: request.tenantId!, isActive: true } });
    if (!category) throw new BadRequestException('Category is inactive or missing');
    if (!Number.isFinite(dto.price)) throw new BadRequestException('Menu item price must be a valid number');
    if (dto.inventoryItemId) {
      const inventoryItem = await this.prisma.inventoryItem.findFirst({ where: { id: dto.inventoryItemId, tenantId: request.tenantId!, isActive: true } });
      if (!inventoryItem) throw new BadRequestException('Inventory item is inactive or missing from this cafe');
    }
    return this.prisma.menuItem.create({ data: { ...dto, tenantId: request.tenantId! } });
  }
  @Patch('menu-items/:id') @RequirePermission('menu.manage') async updateItem(@Param('id') id: string, @Body() dto: Partial<MenuItemDto>, @Req() request: Request) {
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, tenantId: request.tenantId!, isActive: true } });
      if (!category) throw new BadRequestException('Category is inactive or missing');
    }
    if (dto.inventoryItemId) {
      const inventoryItem = await this.prisma.inventoryItem.findFirst({ where: { id: dto.inventoryItemId, tenantId: request.tenantId!, isActive: true } });
      if (!inventoryItem) throw new BadRequestException('Inventory item is inactive or missing from this cafe');
    }
    if (dto.price !== undefined && (!Number.isFinite(dto.price) || dto.price < 0)) throw new BadRequestException('Menu item price must be a valid non-negative number');
    return this.prisma.menuItem.updateMany({ where: { id, tenantId: request.tenantId! }, data: dto });
  }
  @Delete('menu-items/:id') @RequirePermission('menu.manage') deactivateItem(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.menuItem.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: false } });
  }
  @Patch('menu-items/:id/status') @RequirePermission('menu.manage') status(@Param('id') id: string, @Body() dto: ActiveDto, @Req() request: Request) {
    return this.prisma.menuItem.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: dto.isActive } });
  }
}
