import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'net';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '../src/auth/auth.guard';
import { BillsController } from '../src/bills/bills.controller';
import { BillsService } from '../src/bills/bills.service';
import { PrismaService } from '../src/common/prisma.service';
import { PermissionGuard } from '../src/permissions/permission.guard';

const BILL_ID = '4a5de5a4-58f2-4997-9e99-f4eb4d15c8b4';

describe('BillsController', () => {
  let app: INestApplication;
  const close = jest.fn().mockResolvedValue({ id: BILL_ID, status: 'CLOSED' });
  const markPrinted = jest.fn().mockResolvedValue({ id: BILL_ID, status: 'OPEN' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BillsController],
      providers: [{ provide: BillsService, useValue: { close, markPrinted } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { tenantId?: string } } }) => {
          context.switchToHttp().getRequest().tenantId = 'tenant-1';
          return true;
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  async function post(path: string): Promise<Response> {
    const { port } = app.getHttpServer().address() as AddressInfo;
    return fetch(`http://127.0.0.1:${port}/api/v1${path}`, { method: 'POST' });
  }

  // Waiters close a table from the receipt screen. A build that ships without
  // this route answers 404 "Cannot POST", so assert the handler is wired up.
  it('routes POST /bills/:id/close to the service', async () => {
    const response = await post(`/bills/${BILL_ID}/close`);

    expect(response.status).toBe(201);
    expect(close).toHaveBeenCalledWith(BILL_ID, 'tenant-1');
  });

  it('still serves the neighbouring bill routes', async () => {
    const { port } = app.getHttpServer().address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/bills/${BILL_ID}/printed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt: '2026-01-01T00:00:00.000Z' }),
    });

    expect(response.status).toBe(201);
    expect(markPrinted).toHaveBeenCalledWith(BILL_ID, 'tenant-1', '2026-01-01T00:00:00.000Z');
  });
});

describe('BillsService.close', () => {
  const closedAt = new Date('2026-01-01T00:00:00.000Z');

  function build(status: 'OPEN' | 'CLOSED') {
    const tx = {
      bill: {
        findFirst: jest.fn().mockResolvedValue({ id: BILL_ID, tableId: 'table-1', status }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      restaurantTable: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      bill: {
        findFirst: jest.fn().mockResolvedValue({
          id: BILL_ID,
          billNumber: 7n,
          status: 'CLOSED',
          printedAt: null,
          closedAt,
          createdAt: closedAt,
          updatedAt: closedAt,
          tableId: 'table-1',
          table: { id: 'table-1', tableNumber: '1' },
          orders: [],
        }),
      },
    };
    return { tx, service: new BillsService(prisma as unknown as PrismaService) };
  }

  it('closes the open bill and releases the table', async () => {
    const { tx, service } = build('OPEN');

    const bill = await service.close(BILL_ID, 'tenant-1');

    expect(bill.status).toBe('CLOSED');
    expect(tx.bill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: BILL_ID, tenantId: 'tenant-1', status: 'OPEN' }), data: expect.objectContaining({ status: 'CLOSED' }) }),
    );
    expect(tx.restaurantTable.updateMany).toHaveBeenCalledWith({ where: { id: 'table-1', tenantId: 'tenant-1', status: 'OCCUPIED' }, data: { status: 'AVAILABLE' } });
  });

  it('locks the table row so a concurrent order cannot reuse the bill', async () => {
    const { tx, service } = build('OPEN');

    await service.close(BILL_ID, 'tenant-1');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('resolves an order id the same way get() and markPrinted() do', async () => {
    const { tx, service } = build('OPEN');

    await service.close('order-1', 'tenant-1');

    expect(tx.bill.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', OR: [{ id: 'order-1' }, { orders: { some: { id: 'order-1' } } }] }) }),
    );
  });

  it('is a no-op for a bill that is already closed', async () => {
    const { tx, service } = build('CLOSED');

    await service.close(BILL_ID, 'tenant-1');

    expect(tx.bill.updateMany).not.toHaveBeenCalled();
    expect(tx.restaurantTable.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a bill outside the tenant', async () => {
    const { tx, service } = build('OPEN');
    tx.bill.findFirst.mockResolvedValue(null);

    await expect(service.close(BILL_ID, 'tenant-1')).rejects.toThrow('Bill not found');
  });
});
