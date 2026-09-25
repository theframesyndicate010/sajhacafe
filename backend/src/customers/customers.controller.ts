import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { LedgerEntryType } from '@prisma/client';
class CustomerDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() notes?: string;
}
class LedgerDto {
  @IsUUID() customerId!: string;
  @IsOptional() @IsUUID() orderId?: string;
  @IsEnum(LedgerEntryType) type!: LedgerEntryType;
  @Min(0) debit!: number;
  @Min(0) credit!: number;
  @IsString() reference!: string;
  @IsOptional() @IsString() description?: string;
}
@Controller('customers')
@UseGuards(AuthGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @RequirePermission('customers.manage') list(@Req() request: Request, @Query('search') search?: string) {
    return this.prisma.customer.findMany({
      where: { tenantId: request.tenantId!, ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : {}) },
      orderBy: { name: 'asc' },
    });
  }
  @Post() @RequirePermission('customers.manage') create(@Body() dto: CustomerDto, @Req() request: Request) {
    return this.prisma.customer.create({ data: { ...dto, tenantId: request.tenantId! } });
  }
  @Get(':id') @RequirePermission('customers.manage') get(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.customer.findFirstOrThrow({
      where: { id, tenantId: request.tenantId! },
      include: { orders: { include: { items: true } }, ledgerEntries: true },
    });
  }
  @Patch(':id') @RequirePermission('customers.manage') update(
    @Param('id') id: string,
    @Body() dto: Partial<CustomerDto>, @Req() request: Request,
  ) {
    return this.prisma.customer.updateMany({ where: { id, tenantId: request.tenantId! }, data: dto });
  }
  @Get(':id/orders') @RequirePermission('customers.manage') orders(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.order.findMany({
      where: { tenantId: request.tenantId!, customerId: id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get(':id/payments') @RequirePermission('customers.manage') payments(@Param('id') id: string, @Req() request: Request) {
    return this.prisma.payment.findMany({
      where: { tenantId: request.tenantId!, order: { customerId: id, tenantId: request.tenantId! } },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get(':id/statement') @RequirePermission('customers.manage') async statement(
    @Param('id') id: string, @Req() request: Request,
  ) {
    const entries = await this.prisma.customerLedgerEntry.findMany({
      where: { tenantId: request.tenantId!, customerId: id },
      orderBy: { createdAt: 'asc' },
    });
    let balance = 0;
    return entries.map((entry) => {
      balance += Number(entry.debit) - Number(entry.credit);
      return { ...entry, runningBalance: balance };
    });
  }
  @Post(':id/ledger') @RequirePermission('customers.manage') async createLedger(
    @Param('id') customerId: string,
    @Body() dto: Omit<LedgerDto, 'customerId'>,
    @Req() request: Request,
  ) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId: request.tenantId!, isActive: true } });
    if (!customer) throw new BadRequestException('Customer is inactive or missing');
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, tenantId: request.tenantId!, customerId } });
      if (!order) throw new BadRequestException('Order does not belong to this customer');
    }
    return this.prisma.customerLedgerEntry.create({
      data: { ...dto, tenantId: request.tenantId!, customerId, createdBy: request.userId! },
    });
  }
}
