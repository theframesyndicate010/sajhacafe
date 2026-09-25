-- SKU values are allocated by PostgreSQL so concurrent inventory creates cannot collide.
CREATE SEQUENCE IF NOT EXISTS "InventorySkuSequence";
DO $$
DECLARE highest bigint;
BEGIN
  SELECT COALESCE(MAX((substring("sku" from '^INV-([0-9]+)$'))::bigint), 0)
    INTO highest
    FROM "InventoryItem"
    WHERE "sku" ~ '^INV-[0-9]+$';
  IF highest > 0 THEN
    PERFORM setval('"InventorySkuSequence"', highest, true);
  END IF;
END $$;

ALTER TABLE "MenuItem" ADD COLUMN "inventoryItemId" UUID;
CREATE UNIQUE INDEX "MenuItem_tenantId_inventoryItemId_key"
  ON "MenuItem"("tenantId", "inventoryItemId");
CREATE INDEX "MenuItem_inventoryItemId_idx" ON "MenuItem"("inventoryItemId");
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Role" ("id", "name", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'ADMIN', 'Cafe administrator', now(), now()),
  (gen_random_uuid(), 'WAITER', 'Waiter', now(), now()),
  (gen_random_uuid(), 'CASHIER', 'Cashier', now(), now()),
  (gen_random_uuid(), 'KITCHEN', 'Kitchen staff', now(), now())
ON CONFLICT ("name") DO NOTHING;

-- Define the permission keys consumed by API routes, then give only the role
-- families that use those routes the matching grants.
INSERT INTO "Permission" ("id", "key", "description", "createdAt") VALUES
  (gen_random_uuid(), 'orders.create', 'Create orders', now()),
  (gen_random_uuid(), 'orders.read', 'View orders', now()),
  (gen_random_uuid(), 'orders.update', 'Update order status and items', now()),
  (gen_random_uuid(), 'orders.cancel', 'Cancel orders', now()),
  (gen_random_uuid(), 'orders.send_to_kitchen', 'Send orders to the kitchen', now()),
  (gen_random_uuid(), 'payments.read', 'View payments', now()),
  (gen_random_uuid(), 'payments.create', 'Receive payments', now()),
  (gen_random_uuid(), 'payments.refund', 'Process refunds', now()),
  (gen_random_uuid(), 'kitchen.manage', 'Manage kitchen tickets', now()),
  (gen_random_uuid(), 'menu.manage', 'Manage menu and tables', now()),
  (gen_random_uuid(), 'tables.manage', 'Manage dining tables', now()),
  (gen_random_uuid(), 'inventory.read', 'View inventory', now()),
  (gen_random_uuid(), 'inventory.adjust', 'Manage inventory', now()),
  (gen_random_uuid(), 'customers.manage', 'Manage customers', now()),
  (gen_random_uuid(), 'purchases.manage', 'Manage purchases', now()),
  (gen_random_uuid(), 'expenses.manage', 'Manage expenses', now()),
  (gen_random_uuid(), 'audit.read', 'View audit history', now()),
  (gen_random_uuid(), 'users.manage', 'Manage cafe users and settings', now()),
  (gen_random_uuid(), 'reports.read', 'View reports', now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE upper(r."name") IN ('ADMIN', 'CAFE_ADMIN', 'OWNER', 'SUPER_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r JOIN "Permission" p ON p."key" IN
  ('orders.create', 'orders.read', 'orders.update', 'orders.send_to_kitchen')
WHERE upper(r."name") = 'WAITER'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r JOIN "Permission" p ON p."key" IN
  ('orders.create', 'orders.read', 'orders.send_to_kitchen', 'payments.read', 'payments.create')
WHERE upper(r."name") = 'CASHIER'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r JOIN "Permission" p ON p."key" IN ('orders.read', 'kitchen.manage')
WHERE upper(r."name") = 'KITCHEN'
ON CONFLICT DO NOTHING;
