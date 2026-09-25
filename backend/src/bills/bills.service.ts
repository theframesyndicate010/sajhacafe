import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const bills = await this.prisma.bill.findMany({
      where: { tenantId },
      include: { table: true, orders: { include: { items: true, customer: true, payments: { where: { status: 'COMPLETED' } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return bills.map((bill) => this.present(bill));
  }

  async get(id: string, tenantId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { tenantId, OR: [{ id }, { orders: { some: { id } } }] },
      include: { table: true, orders: { include: { items: true, customer: true, payments: { where: { status: 'COMPLETED' } } } } },
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

  private present(bill: {
    id: string; billNumber: bigint; tenantId: string; tableId: string | null; status: 'OPEN' | 'CLOSED';
    printedAt: Date | null; closedAt: Date | null; createdAt: Date; updatedAt: Date; table: { id: string; tableNumber: string } | null;
    orders: { id: string; orderNumber: bigint; subtotal: unknown; discountAmount: unknown; taxAmount: unknown; totalAmount: unknown; status: string; customer: { name: string } | null; items: { id: string; menuItemId: string; itemName: string; quantity: unknown; unitPrice: unknown; totalAmount: unknown; notes: string | null }[]; payments: { id: string; method: string; amount: unknown; referenceNumber: string | null }[] }[];
  }) {
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
