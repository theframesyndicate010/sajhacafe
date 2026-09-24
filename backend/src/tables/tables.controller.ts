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
import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { TableStatus } from '@prisma/client';
class TableDto {
  @IsString() tableNumber!: string;
  @IsInt() @Min(1) capacity!: number;
}
class TableStatusDto {
  @IsEnum(TableStatus) status!: TableStatus;
}
@Controller('tables')
@UseGuards(AuthGuard, PermissionGuard)
export class TablesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list(@Req() request: Request, @Query('status') status?: TableStatus) {
    return this.prisma.restaurantTable.findMany({
      where: { tenantId: request.tenantId!, ...(status ? { status } : {}) },
      include: {
        orders: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          select: { id: true, orderNumber: true, status: true },
        },
      },
      orderBy: { tableNumber: 'asc' },
    });
  }
  @Post() @RequirePermission('menu.manage') create(@Body() dto: TableDto, @Req() request: Request) {
    return this.prisma.restaurantTable.create({ data: { ...dto, tenantId: request.tenantId! } });
  }
  @Patch(':id') @RequirePermission('menu.manage') update(
    @Param('id') id: string,
    @Body() dto: Partial<TableDto>, @Req() request: Request,
  ) {
    return this.prisma.restaurantTable.updateMany({ where: { id, tenantId: request.tenantId! }, data: dto });
  }
  @Patch(':id/status') @RequirePermission('menu.manage') status(
    @Param('id') id: string,
    @Body() dto: TableStatusDto, @Req() request: Request,
  ) {
    return this.prisma.restaurantTable.updateMany({ where: { id, tenantId: request.tenantId! }, data: { status: dto.status } });
  }
  @Delete(':id') @RequirePermission('menu.manage') deactivate(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.restaurantTable.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: false } });
  }
}
