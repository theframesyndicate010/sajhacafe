-- Waiters may mark orders served without receiving broader order edit access.
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES (gen_random_uuid(), 'orders.serve', 'Mark an order served', now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE upper(r."name") = 'WAITER'
  AND p."key" = 'orders.serve'
ON CONFLICT DO NOTHING;
