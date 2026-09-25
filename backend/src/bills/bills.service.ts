import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

const billSelect = {
  id: true,
  billNumber: true,
  status: true,
  printedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  tableId: true,
  table: { select: { id: true, tableNumber: true } },
  orders: {
    select: {
      id: true,
      orderNumber: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      status: true,
      customer: { select: { name: true } },
      items: { select: { id: true, menuItemId: true, itemName: true, quantity: true, unitPrice: true, totalAmount: true, notes: true } },
      payments: { where: { status: 'COMPLETED' }, select: { id: true, method: true, amount: true, referenceNumber: true } },
    },
  },
} satisfies Prisma.BillSelect;

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, status?: BillStatus) {
    const bills = await this.prisma.bill.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      select: billSelect,
      orderBy: { createdAt: 'desc' },
    });
    return bills.map((bill) => this.present(bill));
  }

  async get(id: string, tenantId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { tenantId, OR: [{ id }, { orders: { some: { id } } }] },
      select: billSelect,
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return this.present(bill);
  }

  async markPrinted(id: string, tenantId: string, expectedUpdatedAt: string) {
    const expectedDate = new Date(expectedUpdatedAt);
    if (!Number.isFinite(expectedDate.getTime())) throw new BadRequestException('Bill print timestamp is invalid');
    const bill = await this.prisma.bill.findFirst({ where: { tenantId, OR: [{ id }, { orders: { some: { id } } }] }, select: { id: true } });
    if (!bill) throw new NotFoundException('Bill not found');
    // A stale receipt must not mark newly added bill contents as printed.
    await this.prisma.bill.updateMany({ where: { id: bill.id, tenantId, updatedAt: expectedDate }, data: { printedAt: new Date() } });
    return this.get(bill.id, tenantId);
  }

  async close(id: string, tenantId: string) {
    const billId = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, tenantId }, select: { id: true, tableId: true, status: true } });
      if (!bill) throw new NotFoundException('Bill not found');
      if (bill.tableId) {
        // Match order creation's table lock so a new customer gets a fresh bill.
        await tx.$queryRaw(Prisma.sql`SELECT id FROM RestaurantTable WHERE id = ${bill.tableId} AND tenantId = ${tenantId} FOR UPDATE`);
      }
      if (bill.status === 'OPEN') {
        await tx.bill.updateMany({ where: { id: bill.id, tenantId, status: 'OPEN' }, data: { status: 'CLOSED', closedAt: new Date() } });
        if (bill.tableId) await tx.restaurantTable.updateMany({ where: { id: bill.tableId, tenantId, status: 'OCCUPIED' }, data: { status: 'AVAILABLE' } });
      }
      return bill.id;
    });
    return this.get(billId, tenantId);
  }

  private present(bill: Prisma.BillGetPayload<{ select: typeof billSelect }>) {
    const total = (key: 'subtotal' | 'discountAmount' | 'taxAmount' | 'totalAmount') => bill.orders.reduce((sum, order) => sum + Number(order[key]), 0);
    const payments = bill.orders.flatMap((order) => order.payments);
    const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalAmount = total('totalAmount');
    return {
      id: bill.id,
      billNumber: bill.billNumber.toString(),
      status: bill.status,
      printedAt: bill.printedAt,
      closedAt: bill.closedAt,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
      tableId: bill.tableId,
      table: bill.table,
      orderNumber: bill.orders.map((order) => order.orderNumber).sort((a, b) => a < b ? -1 : 1)[0]?.toString() ?? bill.billNumber.toString(),
      orderCount: bill.orders.length,
      orderIds: bill.orders.map((order) => order.id),
      orders: bill.orders.map((order) => ({
        id: order.id,
        totalAmount: order.totalAmount,
        payments: order.payments,
      })),
      orderStatuses: bill.orders.map((order) => order.status),
      paymentStatus: paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      subtotal: total('subtotal'),
      discountAmount: total('discountAmount'),
      taxAmount: total('taxAmount'),
      totalAmount,
      customer: bill.orders.map((order) => order.customer).find(Boolean) ?? null,
      items: bill.orders.flatMap((order) => order.items),
      payments,
    };
  }
}
