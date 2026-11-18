import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permissions.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const MAX_LOGO_BYTES = 700 * 1024;
const MAX_LOGO_DATA_URL = 960_000;
const RESET_SECTIONS = ['bills', 'menu', 'tables', 'duePayments', 'inventory', 'reports'] as const;
type ResetSection = (typeof RESET_SECTIONS)[number];

@Controller('settings')
@UseGuards(AuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A cafe always has settings, so the row is created on first read instead of
   * being assumed to exist. Tenants created outside the normal setup path
   * previously had no row, which made this endpoint 404 and left the setup form
   * unable to save because the matching `update` had nothing to update.
   */
  @Get()
  async get(@Req() request: Request) {
    const tenantId = request.tenantId!;
    return this.prisma.restaurantSettings.upsert({
      where: { tenantId },
      create: { tenantId, businessName: await this.fallbackName(tenantId) },
      update: {},
    });
  }

  @Patch()
  @RequirePermission('users.manage')
  async update(@Body() dto: UpdateSettingsDto, @Req() request: Request) {
    this.assertValidLogo(dto.logo);
    const tenantId = request.tenantId!;
    return this.prisma.restaurantSettings.upsert({
      where: { tenantId },
      // Spread first so the required columns below always win over the payload.
      create: { ...dto, tenantId, businessName: dto.businessName ?? (await this.fallbackName(tenantId)) },
      update: dto,
    });
  }

  @Post('reset')
  @RequirePermission('users.manage')
  async reset(@Body() body: { sections?: unknown }, @Req() request: Request) {
    const sections = body?.sections;
    if (!Array.isArray(sections) || !sections.length || sections.some((section) => !RESET_SECTIONS.includes(section as ResetSection))) {
      throw new BadRequestException('Select at least one valid section to reset');
    }

    const selected = new Set(sections as ResetSection[]);
    const tenantId = request.tenantId!;
    return this.prisma.$transaction(async (tx) => {
      const releaseTables = async (tableIds?: string[]) => {
        await tx.restaurantTable.updateMany({
          where: { tenantId, status: 'OCCUPIED', ...(tableIds ? { id: { in: tableIds } } : {}) },
          data: { status: 'AVAILABLE' },
        });
      };

      const clearOrders = async (billIds?: string[]) => {
        const where = { tenantId, ...(billIds ? { billId: { in: billIds } } : {}) };
        const tableIds = billIds
          ? (await tx.bill.findMany({ where: { tenantId, id: { in: billIds } }, select: { tableId: true } }))
              .flatMap(({ tableId }) => tableId ? [tableId] : [])
          : [];
        const orders = await tx.order.findMany({ where, select: { id: true } });
        const orderIds = orders.map(({ id }) => id);
        if (!orderIds.length) {
          if (billIds?.length) {
            await tx.bill.deleteMany({ where: { tenantId, id: { in: billIds } } });
            await releaseTables(tableIds);
          }
          return;
        }
        await tx.customerLedgerEntry.deleteMany({ where: { tenantId, orderId: { in: orderIds } } });
        await tx.refund.deleteMany({ where: { tenantId, orderId: { in: orderIds } } });
        await tx.payment.deleteMany({ where: { tenantId, orderId: { in: orderIds } } });
        await tx.kotItem.deleteMany({ where: { tenantId, kot: { orderId: { in: orderIds } } } });
        await tx.kot.deleteMany({ where: { tenantId, orderId: { in: orderIds } } });
        await tx.orderItem.deleteMany({ where: { tenantId, orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds }, tenantId } });
        if (billIds) {
          await tx.bill.deleteMany({ where: { tenantId, id: { in: billIds } } });
          await releaseTables(tableIds);
        }
      };

      if (selected.has('reports')) {
        await clearOrders();
        await tx.bill.deleteMany({ where: { tenantId } });
        await releaseTables();
        await tx.purchaseItem.deleteMany({ where: { tenantId } });
        await tx.purchase.deleteMany({ where: { tenantId } });
        await tx.expense.deleteMany({ where: { tenantId } });
        await tx.customerLedgerEntry.deleteMany({ where: { tenantId } });
        await tx.stockMovement.deleteMany({ where: { tenantId } });
      } else {
        if (selected.has('bills')) {
          await clearOrders();
          await tx.bill.deleteMany({ where: { tenantId } });
          await releaseTables();
        } else if (selected.has('duePayments')) {
          const openBills = await tx.bill.findMany({
            where: { tenantId, status: 'OPEN' },
            select: { id: true, orders: { select: { totalAmount: true, payments: { where: { status: 'COMPLETED' }, select: { amount: true } } } } },
          });
          const dueBillIds = openBills.filter((bill) => bill.orders.some((order) =>
            Number(order.totalAmount) - order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) > 0.009,
          )).map(({ id }) => id);
          await clearOrders(dueBillIds);
        }

      }

      if (selected.has('menu')) {
        await tx.menuItem.updateMany({ where: { tenantId }, data: { isActive: false } });
        await tx.category.updateMany({ where: { tenantId }, data: { isActive: false } });
      }
      if (selected.has('tables')) {
        await tx.order.updateMany({ where: { tenantId }, data: { tableId: null } });
        await tx.bill.updateMany({ where: { tenantId }, data: { tableId: null } });
        await tx.restaurantTable.deleteMany({ where: { tenantId } });
      }
      if (selected.has('inventory')) {
        await tx.stockMovement.deleteMany({ where: { tenantId } });
        await tx.inventoryItem.updateMany({ where: { tenantId }, data: { currentQuantity: 0 } });
      }

      return { reset: [...selected] };
    });
  }

  private async fallbackName(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return tenant?.name ?? 'Cafe';
  }

  private assertValidLogo(logo?: string | null): void {
    if (logo === undefined || logo === null) return;
    const invalid = 'Logo must be a PNG, JPEG, or WebP image smaller than 700 KB';
    if (logo.length > MAX_LOGO_DATA_URL) throw new BadRequestException(invalid);
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
    if (!match) throw new BadRequestException(invalid);
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > MAX_LOGO_BYTES) throw new BadRequestException(invalid);
    const signatures = {
      png: image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      jpeg: image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff,
      webp: image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP',
    };
    if (!signatures[match[1] as keyof typeof signatures]) throw new BadRequestException('The uploaded file does not match its image type');
  }
}
