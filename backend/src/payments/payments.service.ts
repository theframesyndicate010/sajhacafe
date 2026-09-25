import { BadRequestException, Injectable } from '@nestjs/common';
import { Payment } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { RecipeInventoryService } from '../inventory/recipe-inventory.service';
import { PaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeInventory: RecipeInventoryService,
  ) {}

  list(tenantId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId }, include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getById(id: string, tenantId: string) {
    return this.prisma.payment.findFirstOrThrow({
      where: { id, tenantId },
      include: { refunds: true, order: true },
    });
  }

  create(orderId: string, payment: PaymentDto, request: Request) {
    return this.createMany(orderId, [payment], request.userId!, this.idempotencyKey(request), request.tenantId!);
  }

  createSplit(orderId: string, payments: PaymentDto[], request: Request) {
    return this.createMany(orderId, payments, request.userId!, this.idempotencyKey(request), request.tenantId!);
  }

  async refund(id: string, amount: number, reason: string, request: Request) {
    if (!amount || !reason?.trim()) {
      throw new BadRequestException('Refund amount and reason are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirstOrThrow({
        where: { id, tenantId: request.tenantId! },
        include: { refunds: true },
      });
      const refunded = payment.refunds.reduce((sum, item) => sum + Number(item.amount), 0);

      if (refunded + amount > Number(payment.amount)) {
        throw new BadRequestException('Refund exceeds refundable amount');
      }

      const refund = await tx.refund.create({
        data: {
          tenantId: request.tenantId!, paymentId: id,
          orderId: payment.orderId,
          amount,
          reason,
          approvedBy: request.userId!,
          processedBy: request.userId!,
        },
      });

      await tx.payment.updateMany({
        where: { id, tenantId: request.tenantId! },
        data: {
          status: refunded + amount === Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });

      return refund;
    });
  }

  private async createMany(
    orderId: string,
    payments: PaymentDto[],
    userId: string,
    idempotencyKey: string | undefined, tenantId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.payment.findFirst({
          where: { tenantId, idempotencyKey: { startsWith: idempotencyKey } },
        });
        if (existing) return [existing];
      }

      const order = await tx.order.findFirstOrThrow({ where: { id: orderId, tenantId } });
      const paymentTotal = await tx.payment.aggregate({
        where: { tenantId, orderId, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      const paid = Number(paymentTotal._sum.amount ?? 0);
      const requested = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remaining = Number(order.totalAmount) - paid;

      if (requested > remaining + 0.001) {
        throw new BadRequestException('Payment exceeds balance');
      }

      const records: Payment[] = [];
      for (const [index, payment] of payments.entries()) {
        records.push(
          await tx.payment.create({
            data: {
              tenantId, orderId,
              method: payment.method,
              amount: payment.amount,
              referenceNumber: payment.referenceNumber,
              idempotencyKey: idempotencyKey ? `${idempotencyKey}:${index}` : undefined,
              notes: payment.notes,
              receivedBy: userId,
              paidAt: new Date(),
              status: 'COMPLETED',
            },
          }),
        );
      }

      const nextPaid = paid + requested;
      if (nextPaid >= Number(order.totalAmount) && paid < Number(order.totalAmount)) {
        await this.recipeInventory.deductForOrder(tx, orderId, userId, tenantId!);
      }

      await tx.order.updateMany({
        where: { id: orderId, tenantId },
        data: {
          paymentStatus: nextPaid >= Number(order.totalAmount) ? 'PAID' : 'PARTIALLY_PAID',
        },
      });

      if (nextPaid >= Number(order.totalAmount)) {
        const billLock = await tx.bill.findFirst({ where: { id: order.billId, tenantId }, select: { tableId: true } });
        if (billLock?.tableId) {
          await tx.$queryRaw`SELECT id FROM RestaurantTable WHERE id = ${billLock.tableId} AND tenantId = ${tenantId} FOR UPDATE`;
        }
        const bill = await tx.bill.findFirst({
          where: { id: order.billId, tenantId, status: 'OPEN' },
          include: { orders: { include: { payments: { where: { status: 'COMPLETED' }, select: { amount: true } } } } },
        });
        const isBillSettled = bill?.orders.every((billOrder) =>
          billOrder.payments.reduce((sum, record) => sum + Number(record.amount), 0) + 0.001 >= Number(billOrder.totalAmount),
        );
        if (bill && isBillSettled) {
          await tx.bill.updateMany({ where: { id: bill.id, tenantId, status: 'OPEN' }, data: { status: 'CLOSED', closedAt: new Date() } });
          if (bill.tableId) await tx.restaurantTable.updateMany({ where: { id: bill.tableId, tenantId, status: 'OCCUPIED' }, data: { status: 'AVAILABLE' } });
        }
      }

      return records;
    });
  }

  private idempotencyKey(request: Request): string | undefined {
    return request.headers['idempotency-key'] as string | undefined;
  }
}
