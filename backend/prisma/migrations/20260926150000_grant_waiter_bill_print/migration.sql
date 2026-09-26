-- Waiters may print the bills for their tables from the waiter PWA.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p ON p.`key` = 'bills.print'
WHERE UPPER(r.`name`) = 'WAITER';
