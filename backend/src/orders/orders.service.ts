import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, OrderType, Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { calculateOrderTotals } from '../common/domain/order-calculations';
import { assertTransition, ORDER_TRANSITIONS } from '../common/domain/state-machine';
import { CreateOrderDto, OrderItemDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  list(status: OrderStatus | undefined, tenantId: string) {
    return this.prisma.order.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { items: true, table: true, customer: true, payments: { where: { status: 'COMPLETED' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  getById(id: string, tenantId: string) {
    return this.prisma.order.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        items: true,
        table: true,
        customer: true,
        kots: { include: { items: true } },
        payments: true,
      },
    });
  }

  async create(dto: CreateOrderDto, request: Request) {
    this.validateCreateRequest(dto);
    const tenantId = request.tenantId!;

    return this.prisma.$transaction(async (tx) => {
      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: dto.items.map((item) => item.menuItemId) }, tenantId,
          isActive: true,
        },
      });
      const uniqueItemCount = new Set(dto.items.map((item) => item.menuItemId)).size;

      if (menuItems.length !== uniqueItemCount) {
        throw new BadRequestException('One or more menu items are inactive or missing');
      }

      let tableId: string | null = dto.tableId ?? null;
      let bill: { id: string } | null = null;
      if (tableId) {
        const table = await tx.restaurantTable.findFirst({ where: { id: tableId, tenantId, isActive: true } });
        if (!table) throw new BadRequestException('Table is inactive or missing');
        // Serialize order submissions per table. This lets concurrent requests
        // reuse one open bill rather than racing to create two.
        await tx.$queryRaw(Prisma.sql`SELECT id FROM RestaurantTable WHERE id = ${tableId} AND tenantId = ${tenantId} FOR UPDATE`);
        bill = await tx.bill.findFirst({ where: { tenantId, tableId, status: 'OPEN', tableClosedAt: null } });
      }
      const customerName = dto.customerName?.trim();
      if (!bill) bill = await tx.bill.create({ data: { tenantId, tableId, status: 'OPEN', ...(customerName ? { customerName } : {}) } });
      else await tx.bill.update({ where: { id: bill.id }, data: { printedAt: null, ...(customerName ? { customerName } : {}) } });
      if (tableId) await tx.restaurantTable.updateMany({ where: { id: tableId, tenantId }, data: { status: 'OCCUPIED' } });
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId, isActive: true } });
        if (!customer) throw new BadRequestException('Customer is inactive or missing');
      }

      const items = dto.items.map((input) => this.resolveOrderItem(input, menuItems));

      const totals = calculateOrderTotals({
        items,
        discountAmount: dto.discountAmount,
        taxEnabled: false,
      });
      return tx.order.create({
        data: {
          tenantId,
          orderNumber: BigInt(Date.now()),
          orderType: dto.orderType,
          tableId,
          billId: bill.id,
          customerId: dto.customerId,
          createdBy: request.userId!,
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          ...totals,
          notes: dto.notes,
            items: { create: items.map((item) => ({ ...item, tenantId })) },
        },
        include: { items: true },
      });
    });
  }

  async updateStatus(id: string, status: OrderStatus, tenantId: string) {
    const order = await this.prisma.order.findFirstOrThrow({ where: { id, tenantId } });
    assertTransition('order', order.status, status, ORDER_TRANSITIONS);
    return this.prisma.order.updateMany({
      where: { id, tenantId },
      data: { status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) },
    });
  }

  async sendToKitchen(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirstOrThrow({
      where: { id, tenantId },
      include: { items: true },
    });
    assertTransition('order', order.status, 'SENT_TO_KITCHEN', ORDER_TRANSITIONS);
    return this.prisma.$transaction(async (tx) => {
      const kot = await tx.kot.create({
        data: {
          tenantId,
          kotNumber: BigInt(Date.now()),
          orderId: id,
          createdBy: order.createdBy,
          items: {
              create: order.items.map((item) => ({ tenantId,
              orderItemId: item.id,
              quantity: item.quantity,
              notes: item.notes,
            })),
          },
        },
        include: { items: true },
      });
      await tx.order.updateMany({ where: { id, tenantId }, data: { status: 'SENT_TO_KITCHEN' } });
      return kot;
    });
  }

  cancel(id: string, reason: string, request: Request) {
    if (!reason?.trim()) throw new BadRequestException('Cancellation reason is required');
    return this.prisma.order.updateMany({
      where: { id, tenantId: request.tenantId! },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: request.userId,
        cancellationReason: reason,
      },
    });
  }

  async addItem(id: string, dto: OrderItemDto, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirstOrThrow({ where: { id, tenantId } });
      if (!['DRAFT', 'CONFIRMED'].includes(order.status))
        throw new BadRequestException('Order is no longer editable');
      const menu = await tx.menuItem.findFirst({ where: { id: dto.menuItemId, tenantId, isActive: true } });
      if (!menu) throw new BadRequestException('Menu item is inactive or missing');
      const { discountAmount: _discountAmount, ...item } = this.resolveOrderItem(dto, [menu]);
      const created = await tx.orderItem.create({ data: { ...item, tenantId, orderId: id } });
      const updated = await tx.order.findFirstOrThrow({ where: { id, tenantId }, include: { items: true } });
      const totals = calculateOrderTotals({
        items: updated.items.map((line) => ({
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
        discountAmount: Number(updated.discountAmount),
        taxEnabled: Number(updated.taxAmount) > 0,
      });
      await tx.order.updateMany({ where: { id, tenantId }, data: totals });
      return created;
    });
  }

  updateItem(itemId: string, dto: Partial<OrderItemDto>, tenantId: string) {
    return this.prisma.orderItem.updateMany({
      where: { id: itemId, tenantId },
      data: {
        ...(dto.quantity ? { quantity: dto.quantity } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  removeItem(itemId: string, tenantId: string) {
    return this.prisma.orderItem.deleteMany({ where: { id: itemId, tenantId } });
  }

  /**
   * Turns a requested line into the row to persist. A regular menu item is
   * always priced from MenuItem.price, so a client cannot reprice the cafe's
   * menu. Only the tenant's flagged external placeholder accepts a typed name
   * and price, which is how goods that are not on the menu get sold.
   */
  private resolveOrderItem(input: OrderItemDto, menuItems: Array<{ id: string; name: string; price: Prisma.Decimal; isExternal: boolean }>) {
    const menu = menuItems.find((item) => item.id === input.menuItemId)!;
    const overrides = input.itemName !== undefined || input.unitPrice !== undefined;

    if (!menu.isExternal) {
      if (overrides) {
        throw new BadRequestException(`"${menu.name}" is a menu item and cannot be repriced. Add it as a counter item to set a custom name or price.`);
      }
      const unitPrice = Number(menu.price);
      return {
        menuItemId: menu.id,
        itemName: menu.name,
        quantity: input.quantity,
        unitPrice,
        discountAmount: 0,
        totalAmount: input.quantity * unitPrice,
        notes: input.notes,
      };
    }

    const itemName = input.itemName?.trim();
    const unitPrice = input.unitPrice;
    if (!itemName) throw new BadRequestException('A counter item needs an item name.');
    if (unitPrice === undefined || unitPrice <= 0) throw new BadRequestException(`"${itemName}" needs a price greater than zero.`);

    return {
      menuItemId: menu.id,
      itemName,
      quantity: input.quantity,
      unitPrice,
      discountAmount: 0,
      totalAmount: input.quantity * unitPrice,
      notes: input.notes,
    };
  }

  private validateCreateRequest(dto: CreateOrderDto): void {
    if (!dto.items.length) throw new BadRequestException('At least one item is required');
    if (dto.orderType === OrderType.DINE_IN && !dto.tableId)
      throw new BadRequestException('Dine-in orders require a table');
  }
}
