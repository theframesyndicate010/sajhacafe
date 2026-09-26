/**
 * Idempotent first-run bootstrap for a fresh database.
 *
 * `prisma/seed.ts` and `prisma/seed-user.sql` are both gitignored and absent,
 * so neither can be relied on inside a container image. This script is tracked
 * and creates the minimum needed to log in: a tenant, its settings, an ADMIN
 * user, and the membership that links them. Roles and permissions already
 * arrive from the `seed_roles_permissions` migration.
 *
 * Safe to run on every boot: existing rows are left untouched.
 *
 *   npx tsx scripts/seed-admin.ts
 *
 * Environment:
 *   DATABASE_URL                              required (Prisma)
 *   SEED_ADMIN_EMAIL     default admin@sajhacafe.test
 *   SEED_ADMIN_NAME      default Cafe Admin
 *   SEED_ADMIN_PASSWORD  required, no default on purpose
 *   SEED_TENANT_NAME     default Sajha Cafe
 *   SEED_TENANT_SLUG     default sajha-cafe
 *   SEED_DEMO_DATA       default false; adds sample tables and menu items
 */
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@sajhacafe.test').trim().toLowerCase();
const adminName = (process.env.SEED_ADMIN_NAME ?? 'Cafe Admin').trim();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const tenantName = (process.env.SEED_TENANT_NAME ?? 'Sajha Cafe').trim();
const tenantSlug = (process.env.SEED_TENANT_SLUG ?? 'sajha-cafe').trim();
const demoData = process.env.SEED_DEMO_DATA === 'true';
const demoTableCount = 6;

const DEMO_MENU: Array<{ category: string; items: Array<{ name: string; price: number }> }> = [
  { category: 'Coffee', items: [{ name: 'Cappuccino', price: 190 }, { name: 'Americano', price: 150 }, { name: 'Masala Tea', price: 80 }] },
  { category: 'Momo', items: [{ name: 'Chicken Momo', price: 260 }, { name: 'Veg Momo', price: 220 }] },
  { category: 'Cakes', items: [{ name: 'Carrot Cake', price: 320 }, { name: 'Chocolate Cake', price: 350 }] },
];

async function main(): Promise<void> {
  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD is required so the admin account gets a known password.');
  }

  const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' }, select: { id: true } });
  if (!adminRole) {
    throw new Error('No ADMIN role found. Run `npx prisma migrate deploy` before this script.');
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  const tenant = existingTenant ?? (await prisma.tenant.create({ data: { name: tenantName, slug: tenantSlug } }));
  const existingSettings = await prisma.restaurantSettings.findUnique({ where: { tenantId: tenant.id }, select: { id: true } });
  if (!existingSettings) {
    await prisma.restaurantSettings.create({ data: { tenantId: tenant.id, businessName: tenantName } });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  if (existingUser) {
    // Keep the membership in sync in case the role was reseeded underneath us.
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: existingUser.id } },
      update: { roleId: adminRole.id, isActive: true },
      create: { tenantId: tenant.id, userId: existingUser.id, roleId: adminRole.id },
    });
  } else {
    const user = await prisma.user.create({
      data: { name: adminName, email: adminEmail, passwordHash: await argon2.hash(adminPassword) },
      select: { id: true },
    });
    await prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: user.id, roleId: adminRole.id } });
    console.log(`[seed] created admin ${adminEmail}`);
  }

  if (demoData) {
    const created = await seedDemoContent(tenant.id);
    console.log(`[seed] demo content ready (${created} new menu items, tables up to ${demoTableCount})`);
  }

  console.log(`[seed] tenant "${tenantName}" (${tenantSlug}) ready`);
  console.log(`[seed] admin login: ${adminEmail}`);
}

async function seedDemoContent(tenantId: string): Promise<number> {
  let createdItems = 0;
  for (const [order, group] of DEMO_MENU.entries()) {
    const existingCategory = await prisma.category.findFirst({ where: { tenantId, name: group.category }, select: { id: true } });
    const category =
      existingCategory ??
      (await prisma.category.create({ data: { tenantId, name: group.category, displayOrder: order } }));
    for (const item of group.items) {
      const existingItem = await prisma.menuItem.findFirst({ where: { tenantId, name: item.name }, select: { id: true } });
      if (existingItem) continue;
      await prisma.menuItem.create({ data: { tenantId, categoryId: category.id, name: item.name, price: item.price } });
      createdItems += 1;
    }
  }

  const tables = await prisma.restaurantTable.findMany({ where: { tenantId }, select: { tableNumber: true } });
  const taken = new Set(tables.map((table) => table.tableNumber));
  const missing = Array.from({ length: demoTableCount }, (_, index) => `Table ${index + 1}`).filter((name) => !taken.has(name));
  if (missing.length) {
    await prisma.restaurantTable.createMany({
      data: missing.map((tableNumber) => ({ tenantId, tableNumber, capacity: 4 })),
    });
  }
  return createdItems;
}

main()
  .catch((error: unknown) => {
    console.error('[seed] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
