import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roleSeeds = [
  { name: 'ADMIN', description: 'Cafe administrator' },
  { name: 'WAITER', description: 'Waiter' },
  { name: 'CASHIER', description: 'Cashier' },
  { name: 'KITCHEN', description: 'Kitchen staff' },
] as const;

const permissionSeeds = [
  ['orders.create', 'Create orders'],
  ['orders.read', 'View orders'],
  ['orders.update', 'Update order status and items'],
  ['orders.cancel', 'Cancel orders'],
  ['orders.serve', 'Mark an order served'],
  ['orders.send_to_kitchen', 'Send orders to the kitchen'],
  ['payments.read', 'View payments'],
  ['payments.create', 'Receive payments'],
  ['payments.refund', 'Process refunds'],
  ['kitchen.manage', 'Manage kitchen tickets'],
  ['menu.manage', 'Manage menu and tables'],
  ['tables.manage', 'Manage dining tables'],
  ['inventory.read', 'View inventory'],
  ['inventory.adjust', 'Manage inventory'],
  ['customers.manage', 'Manage customers'],
  ['purchases.manage', 'Manage purchases'],
  ['expenses.manage', 'Manage expenses'],
  ['audit.read', 'View audit history'],
  ['users.manage', 'Manage cafe users and settings'],
  ['reports.read', 'View reports'],
  ['bills.print', 'Record bill printing status'],
] as const;

const grants: Record<string, readonly string[]> = {
  ADMIN: permissionSeeds.map(([key]) => key),
  WAITER: ['orders.create', 'orders.read', 'orders.update', 'orders.send_to_kitchen', 'orders.serve', 'payments.read', 'payments.create', 'bills.print'],
  CASHIER: ['orders.create', 'orders.read', 'orders.send_to_kitchen', 'payments.read', 'payments.create', 'bills.print'],
  KITCHEN: ['orders.read', 'kitchen.manage'],
};

async function main(): Promise<void> {
  const roleIds = new Map<string, string>();
  for (const role of roleSeeds) {
    const saved = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
      select: { id: true },
    });
    roleIds.set(role.name, saved.id);
  }

  const permissionIds = new Map<string, string>();
  for (const [key, description] of permissionSeeds) {
    const saved = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
      select: { id: true },
    });
    permissionIds.set(key, saved.id);
  }

  for (const [roleName, permissionKeys] of Object.entries(grants)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIds.get(permissionKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
}

main()
  .then(async () => {
    console.log('Prisma seed completed.');
  })
  .catch((error: unknown) => {
    console.error('Prisma seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
