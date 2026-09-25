DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND upper(r."name") = 'WAITER'
  AND p."key" = 'bills.print';
