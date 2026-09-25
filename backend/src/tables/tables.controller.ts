import {
  Body,
  BadRequestException,
  ConflictException,
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
import { IsEnum, IsInt, IsString, Min, Max, MaxLength, IsNotEmpty } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { TableStatus } from '@prisma/client';
class TableDto {
  @IsString() @IsNotEmpty() @MaxLength(30) tableNumber!: string;
  @IsInt() @Min(1) capacity!: number;
}
class BulkTableDto {
  @IsString() @IsNotEmpty() @MaxLength(24) prefix!: string;
  @IsInt() @Min(1) @Max(100) count!: number;
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
          where: { bill: { status: 'OPEN' } },
          select: { id: true, orderNumber: true, status: true },
        },
      },
      orderBy: { tableNumber: 'asc' },
    });
  }
  @Post() @RequirePermission('tables.manage') async create(@Body() dto: TableDto, @Req() request: Request) {
    const tableNumber = dto.tableNumber.trim();
    if (!tableNumber) throw new BadRequestException('Table name is required');
    if (await this.prisma.restaurantTable.findFirst({ where: { tenantId: request.tenantId!, tableNumber } }))
      throw new ConflictException('A table with this name already exists');
    return this.prisma.restaurantTable.create({ data: { tableNumber, capacity: dto.capacity, tenantId: request.tenantId! } });
  }
  @Post('bulk') @RequirePermission('tables.manage') async createMany(@Body() dto: BulkTableDto, @Req() request: Request) {
    const prefix = dto.prefix.trim();
    if (!prefix) throw new BadRequestException('Table name is required');
    const names = Array.from({ length: dto.count }, (_, index) => `${prefix} ${index + 1}`);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.restaurantTable.findMany({ where: { tenantId: request.tenantId!, tableNumber: { in: names } }, select: { tableNumber: true } });
      if (existing.length) throw new ConflictException(`Table ${existing[0].tableNumber} already exists`);
      return Promise.all(names.map((tableNumber) => tx.restaurantTable.create({ data: { tenantId: request.tenantId!, tableNumber, capacity: dto.capacity } })));
    });
  }
  @Patch(':id') @RequirePermission('tables.manage') update(
    @Param('id') id: string,
    @Body() dto: Partial<TableDto>, @Req() request: Request,
  ) {
    return this.prisma.restaurantTable.updateMany({ where: { id, tenantId: request.tenantId! }, data: dto });
  }
  @Patch(':id/status') @RequirePermission('tables.manage') status(
    @Param('id') id: string,
    @Body() dto: TableStatusDto, @Req() request: Request,
  ) {
    return this.prisma.restaurantTable.updateMany({ where: { id, tenantId: request.tenantId! }, data: { status: dto.status } });
  }
  @Delete(':id') @RequirePermission('tables.manage') deactivate(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.restaurantTable.updateMany({ where: { id, tenantId: request.tenantId! }, data: { isActive: false } });
  }
}
