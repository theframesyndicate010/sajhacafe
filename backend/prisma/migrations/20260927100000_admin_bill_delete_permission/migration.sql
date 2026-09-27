INSERT INTO `Permission` (`id`, `key`, `description`, `createdAt`)
VALUES (UUID(), 'bills.delete', 'Delete eligible draft bills', NOW(3))
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p ON p.`key` = 'bills.delete'
WHERE UPPER(r.`name`) IN ('ADMIN', 'CAFE_ADMIN', 'OWNER', 'SUPER_ADMIN');
