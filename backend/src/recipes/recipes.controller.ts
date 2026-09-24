import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsNumber, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
class RecipeItemDto {
  @IsUUID() inventoryItemId!: string;
  @IsNumber() @Min(0.0001) quantity!: number;
  @IsString() unit!: string;
}
class RecipeDto {
  @IsUUID() menuItemId!: string;
  @IsString() name!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RecipeItemDto) items!: RecipeItemDto[];
}
@Controller('recipes')
@UseGuards(AuthGuard, PermissionGuard)
export class RecipesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':menuItemId') @RequirePermission('menu.manage') list(
    @Param('menuItemId') menuItemId: string, @Req() request: Request,
  ) {
    return this.prisma.recipe.findMany({
      where: { menuItemId, tenantId: request.tenantId! },
      include: { items: { include: { inventoryItem: true } } },
    });
  }
  @Post() @RequirePermission('menu.manage') create(@Body() dto: RecipeDto, @Req() request: Request) {
    return this.assertReferences(dto, request.tenantId!).then(() => this.prisma.recipe.create({
      data: { tenantId: request.tenantId!, menuItemId: dto.menuItemId, name: dto.name, items: { create: dto.items.map((item) => ({ ...item, tenantId: request.tenantId! })) } },
      include: { items: true },
    }));
  }
  private async assertReferences(dto: RecipeDto, tenantId: string) {
    const menuItem = await this.prisma.menuItem.findFirst({ where: { id: dto.menuItemId, tenantId, isActive: true } });
    const inventoryIds = [...new Set(dto.items.map((item) => item.inventoryItemId))];
    const inventoryCount = await this.prisma.inventoryItem.count({ where: { id: { in: inventoryIds }, tenantId, isActive: true } });
    if (!menuItem || inventoryCount !== inventoryIds.length) throw new BadRequestException('Recipe references an inactive or missing item');
  }
  @Patch(':id') @RequirePermission('menu.manage') update(
    @Param('id') id: string,
    @Body() dto: Partial<RecipeDto>, @Req() request: Request,
  ) {
    const tenantId = request.tenantId!;
    return this.prisma.recipe.findFirstOrThrow({ where: { id, tenantId } }).then(async (recipe) => {
      if (dto.items) await this.assertReferences({
        menuItemId: dto.menuItemId ?? recipe.menuItemId,
        name: dto.name ?? recipe.name,
        items: dto.items,
      }, tenantId);
      return this.prisma.recipe.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.items ? { items: { deleteMany: {}, create: dto.items.map((item) => ({ ...item, tenantId })) } } : {}),
        },
        include: { items: true },
      });
    });
  }
  @Post(':id/deactivate') @RequirePermission('menu.manage') deactivate(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.recipe.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: false } });
  }
}
