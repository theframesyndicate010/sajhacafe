import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
@Controller('reports')
@UseGuards(AuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('sales') @RequirePermission('reports.read') async sales(
    @Req() request: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.order.aggregate({
      where: {
        tenantId: request.tenantId!, createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
        status: { not: 'CANCELLED' },
      },
      _count: true,
      _sum: { subtotal: true, discountAmount: true, taxAmount: true, totalAmount: true },
    });
  }
  @Get('payments') @RequirePermission('reports.read') payments(
    @Req() request: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        tenantId: request.tenantId!, createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      _count: true,
    });
  }
  @Get('inventory') @RequirePermission('reports.read') inventory(
    @Req() request: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.stockMovement.findMany({
      where: {
        tenantId: request.tenantId!, createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
      include: { inventoryItem: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('purchases') @RequirePermission('reports.read') purchases(@Req() request: Request) {
    return this.prisma.purchase.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { tenantId: request.tenantId!, status: 'COMPLETED' },
    });
  }
  @Get('expenses') @RequirePermission('reports.read') expenses(@Req() request: Request) {
    return this.prisma.expense.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { tenantId: request.tenantId!, isCancelled: false },
    });
  }
  @Get('customer-dues') @RequirePermission('reports.read') dues(@Req() request: Request) {
    return this.prisma.customer
      .findMany({ where: { tenantId: request.tenantId!, isActive: true }, include: { ledgerEntries: true } })
      .then((customers) =>
        customers
          .map((customer) => ({
            ...customer,
            balance: customer.ledgerEntries.reduce(
              (sum, entry) => sum + Number(entry.debit) - Number(entry.credit),
              0,
            ),
          }))
          .filter((customer) => customer.balance > 0),
      );
  }
}
