CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'CLOSED');

INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES (gen_random_uuid(), 'bills.print', 'Record bill printing status', now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE upper(r."name") IN ('ADMIN', 'CAFE_ADMIN', 'OWNER', 'SUPER_ADMIN', 'WAITER', 'CASHIER')
  AND p."key" = 'bills.print'
ON CONFLICT DO NOTHING;

CREATE TABLE "Bill" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "tableId" UUID,
  "billNumber" BIGSERIAL NOT NULL,
  "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
  "printedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "billId" UUID;

-- Preserve every existing order as a bill, then consolidate currently open
-- table orders into one bill per tenant/table. Each order remains separate for
-- kitchen tickets, audit history, and the existing order-based payment ledger.
INSERT INTO "Bill" ("id", "tenantId", "tableId", "status", "closedAt", "createdAt", "updatedAt")
SELECT
  o."id",
  o."tenantId",
  o."tableId",
  CASE
    WHEN o."paymentStatus" = 'PAID' OR o."status" IN ('COMPLETED', 'CANCELLED') THEN 'CLOSED'::"BillStatus"
    ELSE 'OPEN'::"BillStatus"
  END,
  CASE
    WHEN o."paymentStatus" = 'PAID' OR o."status" IN ('COMPLETED', 'CANCELLED') THEN COALESCE(o."completedAt", o."cancelledAt", o."updatedAt")
    ELSE NULL
  END,
  o."createdAt",
  o."updatedAt"
FROM "Order" o;

UPDATE "Order" SET "billId" = "id";

WITH open_table_bills AS (
  SELECT
    "id",
    first_value("id") OVER (PARTITION BY "tenantId", "tableId" ORDER BY "createdAt", "billNumber") AS "canonicalId"
  FROM "Bill"
  WHERE "status" = 'OPEN' AND "tableId" IS NOT NULL
)
UPDATE "Order" o
SET "billId" = grouped."canonicalId"
FROM open_table_bills grouped
WHERE o."billId" = grouped."id";

WITH open_table_bills AS (
  SELECT
    "id",
    first_value("id") OVER (PARTITION BY "tenantId", "tableId" ORDER BY "createdAt", "billNumber") AS "canonicalId"
  FROM "Bill"
  WHERE "status" = 'OPEN' AND "tableId" IS NOT NULL
)
DELETE FROM "Bill" b
USING open_table_bills grouped
WHERE b."id" = grouped."id" AND grouped."id" <> grouped."canonicalId";

ALTER TABLE "Order" ALTER COLUMN "billId" SET NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE INDEX "Bill_tenantId_status_createdAt_idx" ON "Bill"("tenantId", "status", "createdAt");
CREATE INDEX "Bill_tenantId_tableId_status_idx" ON "Bill"("tenantId", "tableId", "status");
CREATE INDEX "Order_billId_idx" ON "Order"("billId");
CREATE UNIQUE INDEX "Bill_one_open_per_table_key" ON "Bill"("tenantId", "tableId")
  WHERE "tableId" IS NOT NULL AND "status" = 'OPEN';

-- Bring table state in line with existing unsettled orders.
UPDATE "RestaurantTable" t
SET "status" = CASE WHEN EXISTS (
  SELECT 1 FROM "Bill" b WHERE b."tenantId" = t."tenantId" AND b."tableId" = t."id" AND b."status" = 'OPEN'
) THEN 'OCCUPIED'::"TableStatus" ELSE 'AVAILABLE'::"TableStatus" END
WHERE t."status" IN ('AVAILABLE', 'OCCUPIED');
