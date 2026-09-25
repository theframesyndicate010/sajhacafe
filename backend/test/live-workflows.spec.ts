import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/http/exception.filter';
import { PrismaService } from '../src/common/prisma.service';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';

const enabled = process.env.RUN_DB_WORKFLOW_SMOKE === 'true';
const spec = enabled ? describe : describe.skip;

spec('live multi-tenant workflows (temporary fixtures)', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let prisma: PrismaService;
  let baseUrl: string;
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const password = 'smoke-test-password';
  const roles = new Map<string, string>();

  async function call(path: string, options: { cookie?: string; method?: string; body?: unknown } = {}) {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const json = await response.json();
    return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }

  async function makeTenant(slug: string) {
    const tenant = await prisma.tenant.create({ data: { name: slug, slug } });
    tenantIds.push(tenant.id);
    await prisma.restaurantSettings.create({ data: { tenantId: tenant.id, businessName: slug } });
    const accounts: Record<string, string> = {};
    for (const roleName of ['WAITER', 'CASHIER']) {
      const roleId = roles.get(roleName);
      if (!roleId) throw new Error(`Required ${roleName} role is missing`);
      const email = `${roleName.toLowerCase()}-${slug}@example.test`;
      const user = await prisma.user.create({ data: { name: roleName, email, passwordHash: await argon2.hash(password) } });
      userIds.push(user.id);
      await prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: user.id, roleId } });
      accounts[roleName] = email;
    }
    return { tenant, accounts };
  }

  async function login(email: string) {
    const result = await call('/auth/login', { method: 'POST', body: { email, password } });
    expect(result.status).toBe(201);
    expect(result.cookie).toContain('cafe_session=');
    return result.cookie!;
  }

  beforeAll(async () => {
    const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.setGlobalPrefix('api/v1');
    app.use(helmet());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Test API did not bind to a local port');
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    const foundRoles = await prisma.role.findMany({ where: { name: { in: ['ADMIN', 'WAITER', 'CASHIER'] } }, select: { id: true, name: true } });
    for (const role of foundRoles) roles.set(role.name, role.id);
    await makeTenant(`workflow-a-${timestamp}`);
    await makeTenant(`workflow-b-${timestamp}`);
  }, 30_000);

  afterAll(async () => {
    if (prisma && tenantIds.length) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (app) await app.close();
  }, 30_000);

  it('checks menu price, table, inventory, waiter order, cashier payment, users, branding, and tenant isolation', async () => {
    expect(roles.size).toBe(3);
    const testTenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, orderBy: { slug: 'asc' }, include: { memberships: { include: { user: true, role: true } } } });
    const tenantA = testTenants[0];
    const tenantB = testTenants[1];
    const emailFor = (tenant: typeof tenantA, roleName: string) => tenant.memberships.find((membership) => membership.role.name === roleName)!.user.email;
    const adminCookie = await login(emailFor(tenantA, 'ADMIN'));
    const waiterCookie = await login(emailFor(tenantA, 'WAITER'));
    const cashierCookie = await login(emailFor(tenantA, 'CASHIER'));
    const otherWaiterCookie = await login(emailFor(tenantB, 'WAITER'));

    const tableResult = await call('/tables/bulk', { method: 'POST', cookie: adminCookie, body: { prefix: 'Table', count: 1, capacity: 4 } });
    expect(tableResult.status).toBe(201);
    const table = tableResult.json.data[0];
    expect(table.status).toBe('AVAILABLE');
    expect((await call('/tables', { cookie: waiterCookie })).json.data.map((entry: { id: string }) => entry.id)).toContain(table.id);

    const inventoryResult = await call('/inventory', { method: 'POST', cookie: adminCookie, body: { name: 'Chicken Burger', unit: 'pcs', initialQuantity: 50, minimumQuantity: 10, costPrice: 100 } });
    expect(inventoryResult.status).toBe(201);
    const inventory = inventoryResult.json.data;
    expect(inventory.sku).toMatch(/^INV-\d{6,}$/);
    expect(Number(inventory.currentQuantity)).toBe(50);

    const categoryResult = await call('/categories', { method: 'POST', cookie: adminCookie, body: { name: 'Workflow food' } });
    const menuResult = await call('/menu-items', { method: 'POST', cookie: adminCookie, body: { categoryId: categoryResult.json.data.id, inventoryItemId: inventory.id, name: 'Chicken Burger', price: 325.75 } });
    expect(menuResult.status).toBe(201);
    expect(menuResult.json.data.price).toBe(325.75);
    const waiterMenu = await call('/menu-items?activeOnly=true', { cookie: waiterCookie });
    expect(waiterMenu.json.data.find((item: { id: string }) => item.id === menuResult.json.data.id).price).toBe(325.75);

    const orderResult = await call('/orders', { method: 'POST', cookie: waiterCookie, body: { orderType: 'DINE_IN', tableId: table.id, items: [{ menuItemId: menuResult.json.data.id, quantity: 1 }] } });
    expect(orderResult.status).toBe(201);
    expect(orderResult.json.data.items[0].unitPrice).toBe(325.75);
    expect(orderResult.json.data.totalAmount).toBe(325.75);
    const kitchenResult = await call(`/orders/${orderResult.json.data.id}/send-to-kitchen`, { method: 'POST', cookie: waiterCookie });
    if (kitchenResult.status !== 201) throw new Error(`Kitchen submission failed: ${JSON.stringify(kitchenResult.json)}`);

    const initialBills = await call('/bills', { cookie: waiterCookie });
    expect(initialBills.status).toBe(200);
    const firstBill = initialBills.json.data.find((bill: { tableId: string }) => bill.tableId === table.id);
    expect(firstBill).toBeDefined();
    expect(firstBill.status).toBe('OPEN');
    const printed = await call(`/bills/${firstBill.id}/printed`, { method: 'POST', cookie: waiterCookie, body: { updatedAt: firstBill.updatedAt } });
    expect(printed.status).toBe(201);
    expect(printed.json.data.printedAt).toBeTruthy();

    const secondOrder = await call('/orders', { method: 'POST', cookie: waiterCookie, body: { orderType: 'DINE_IN', tableId: table.id, items: [{ menuItemId: menuResult.json.data.id, quantity: 2 }] } });
    expect(secondOrder.status).toBe(201);
    const secondKitchenResult = await call(`/orders/${secondOrder.json.data.id}/send-to-kitchen`, { method: 'POST', cookie: waiterCookie });
    expect(secondKitchenResult.status).toBe(201);
    const mergedBillResult = await call(`/bills/${firstBill.id}`, { cookie: waiterCookie });
    expect(mergedBillResult.status).toBe(200);
    expect(mergedBillResult.json.data.orderCount).toBe(2);
    expect(mergedBillResult.json.data.items).toHaveLength(2);
    expect(mergedBillResult.json.data.totalAmount).toBe(977.25);
    expect(mergedBillResult.json.data.printedAt).toBeNull();

    const paymentResult = await call(`/orders/${orderResult.json.data.id}/payments`, { method: 'POST', cookie: cashierCookie, body: { method: 'CASH', amount: 325.75 } });
    expect(paymentResult.status).toBe(201);
    expect((await call(`/bills/${firstBill.id}`, { cookie: waiterCookie })).json.data.status).toBe('OPEN');
    const secondPayment = await call(`/orders/${secondOrder.json.data.id}/payments`, { method: 'POST', cookie: cashierCookie, body: { method: 'CASH', amount: 651.5 } });
    expect(secondPayment.status).toBe(201);
    expect((await call(`/bills/${firstBill.id}`, { cookie: waiterCookie })).json.data.status).toBe('CLOSED');
    expect((await call('/tables', { cookie: waiterCookie })).json.data.find((entry: { id: string }) => entry.id === table.id).status).toBe('AVAILABLE');

    const nextSessionOrder = await call('/orders', { method: 'POST', cookie: waiterCookie, body: { orderType: 'DINE_IN', tableId: table.id, items: [{ menuItemId: menuResult.json.data.id, quantity: 1 }] } });
    expect(nextSessionOrder.status).toBe(201);
    const nextSessionBill = (await call('/bills', { cookie: waiterCookie })).json.data.find((bill: { tableId: string; status: string }) => bill.tableId === table.id && bill.status === 'OPEN');
    expect(nextSessionBill).toBeDefined();
    expect(nextSessionBill.id).not.toBe(firstBill.id);

    const tableTwo = await call('/tables', { method: 'POST', cookie: adminCookie, body: { tableNumber: 'Table 2', capacity: 4 } });
    expect(tableTwo.status).toBe(201);
    const differentTableOrder = await call('/orders', { method: 'POST', cookie: waiterCookie, body: { orderType: 'DINE_IN', tableId: tableTwo.json.data.id, items: [{ menuItemId: menuResult.json.data.id, quantity: 1 }] } });
    expect(differentTableOrder.status).toBe(201);
    const differentTableBill = (await call('/bills', { cookie: waiterCookie })).json.data.find((bill: { tableId: string; status: string }) => bill.tableId === tableTwo.json.data.id && bill.status === 'OPEN');
    expect(differentTableBill).toBeDefined();
    expect(differentTableBill.id).not.toBe(nextSessionBill.id);
    expect((await call('/bills', { cookie: otherWaiterCookie })).json.data).toHaveLength(0);

    const stockedAfterSale = await call('/inventory', { cookie: adminCookie });
    expect(Number(stockedAfterSale.json.data.find((item: { id: string }) => item.id === inventory.id).currentQuantity)).toBe(47);
    await call(`/inventory/${inventory.id}`, { method: 'PATCH', cookie: adminCookie, body: { minimumQuantity: 49 } });
    const lowStock = await call('/inventory/low-stock', { cookie: adminCookie });
    expect(lowStock.json.data.some((item: { id: string }) => item.id === inventory.id)).toBe(true);

    const forbiddenTable = await call('/tables/bulk', { method: 'POST', cookie: waiterCookie, body: { prefix: 'Not allowed', count: 1, capacity: 4 } });
    expect(forbiddenTable.status).toBe(403);
    expect((await call('/menu-items?activeOnly=true', { cookie: otherWaiterCookie })).json.data).toHaveLength(0);
    expect((await call(`/orders/${orderResult.json.data.id}`, { cookie: otherWaiterCookie })).status).toBe(404);
    expect((await call('/orders', { method: 'POST', cookie: otherWaiterCookie, body: { orderType: 'DINE_IN', tableId: table.id, items: [{ menuItemId: menuResult.json.data.id, quantity: 1 }] } })).status).toBe(400);

    const managedUser = await call('/users', { method: 'POST', cookie: adminCookie, body: { name: 'Workflow user', email: `managed-${Date.now()}@example.test`, password, roleId: roles.get('CASHIER') } });
    expect(managedUser.status).toBe(201);
    userIds.push(managedUser.json.data.id);
    const editedUser = await call(`/users/${managedUser.json.data.id}`, { method: 'PATCH', cookie: adminCookie, body: { name: 'Updated workflow user' } });
    expect(editedUser.json.data.name).toBe('Updated workflow user');
    const passwordChanged = await call(`/users/${managedUser.json.data.id}/password`, { method: 'POST', cookie: adminCookie, body: { password: 'new-smoke-password' } });
    expect(passwordChanged.status).toBe(201);
    expect((await call('/auth/login', { method: 'POST', body: { email: managedUser.json.data.email, password: 'new-smoke-password' } })).status).toBe(201);
    expect((await call(`/users/${managedUser.json.data.id}`, { method: 'DELETE', cookie: adminCookie })).status).toBe(200);

    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/+h8AAAAASUVORK5CYII=';
    expect((await call('/settings', { method: 'PATCH', cookie: adminCookie, body: { logo } })).status).toBe(200);
    expect((await call('/settings', { cookie: waiterCookie })).json.data.logo).toBe(logo);
    expect((await call('/settings', { method: 'PATCH', cookie: adminCookie, body: { logo: null } })).status).toBe(200);
  }, 300_000);
});
