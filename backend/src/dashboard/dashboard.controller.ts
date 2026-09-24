import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
@Controller('dashboard')
@UseGuards(AuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('summary') @RequirePermission('reports.read') async summary(@Req() request: Request) {
    const tenantId = request.tenantId!;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [
      sales,
      orders,
      pendingKot,
      preparingKot,
      readyKot,
      occupiedTables,
      availableTables,
      lowStockItems,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { tenantId, createdAt: { gte: start }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: { tenantId, createdAt: { gte: start }, status: { not: 'CANCELLED' } },
      }),
      this.prisma.kot.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.kot.count({ where: { tenantId, status: 'PREPARING' } }),
      this.prisma.kot.count({ where: { tenantId, status: 'READY' } }),
      this.prisma.restaurantTable.count({ where: { tenantId, status: 'OCCUPIED', isActive: true } }),
      this.prisma.restaurantTable.count({ where: { tenantId, status: 'AVAILABLE', isActive: true } }),
      this.prisma.inventoryItem
        .findMany({ where: { tenantId, isActive: true } })
        .then(
          (items) =>
            items.filter((item) => Number(item.currentQuantity) <= Number(item.minimumQuantity))
              .length,
        ),
    ]);
    return {
      sales: sales._sum.totalAmount ?? 0,
      orders,
      pendingKot,
      preparingKot,
      readyKot,
      occupiedTables,
      availableTables,
      lowStockItems,
    };
  }
}
