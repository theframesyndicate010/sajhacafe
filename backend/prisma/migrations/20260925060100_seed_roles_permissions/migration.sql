-- Bootstrap the global roles and permissions used by the API.
-- This is MySQL SQL and is safe to apply through `prisma migrate deploy`.

INSERT INTO `Role` (`id`, `name`, `description`, `createdAt`, `updatedAt`)
VALUES
  (UUID(), 'ADMIN', 'Cafe administrator', NOW(3), NOW(3)),
  (UUID(), 'WAITER', 'Waiter', NOW(3), NOW(3)),
  (UUID(), 'CASHIER', 'Cashier', NOW(3), NOW(3)),
  (UUID(), 'KITCHEN', 'Kitchen staff', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `updatedAt` = NOW(3);

INSERT INTO `Permission` (`id`, `key`, `description`, `createdAt`)
VALUES
  (UUID(), 'orders.create', 'Create orders', NOW(3)),
  (UUID(), 'orders.read', 'View orders', NOW(3)),
  (UUID(), 'orders.update', 'Update order status and items', NOW(3)),
  (UUID(), 'orders.cancel', 'Cancel orders', NOW(3)),
  (UUID(), 'orders.serve', 'Mark an order served', NOW(3)),
  (UUID(), 'orders.send_to_kitchen', 'Send orders to the kitchen', NOW(3)),
  (UUID(), 'payments.read', 'View payments', NOW(3)),
  (UUID(), 'payments.create', 'Receive payments', NOW(3)),
  (UUID(), 'payments.refund', 'Process refunds', NOW(3)),
  (UUID(), 'kitchen.manage', 'Manage kitchen tickets', NOW(3)),
  (UUID(), 'menu.manage', 'Manage menu and tables', NOW(3)),
  (UUID(), 'tables.manage', 'Manage dining tables', NOW(3)),
  (UUID(), 'inventory.read', 'View inventory', NOW(3)),
  (UUID(), 'inventory.adjust', 'Manage inventory', NOW(3)),
  (UUID(), 'customers.manage', 'Manage customers', NOW(3)),
  (UUID(), 'purchases.manage', 'Manage purchases', NOW(3)),
  (UUID(), 'expenses.manage', 'Manage expenses', NOW(3)),
  (UUID(), 'audit.read', 'View audit history', NOW(3)),
  (UUID(), 'users.manage', 'Manage cafe users and settings', NOW(3)),
  (UUID(), 'reports.read', 'View reports', NOW(3)),
  (UUID(), 'bills.print', 'Record bill printing status', NOW(3))
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);

-- Administrators receive every built-in permission.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
CROSS JOIN `Permission` p
WHERE UPPER(r.`name`) IN ('ADMIN', 'CAFE_ADMIN', 'OWNER', 'SUPER_ADMIN');

-- Waiters can create and send orders, serve them, and receive payments.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p
  ON p.`key` IN (
    'orders.create',
    'orders.read',
    'orders.update',
    'orders.serve',
    'orders.send_to_kitchen',
    'payments.read',
    'payments.create'
  )
WHERE UPPER(r.`name`) = 'WAITER';

-- Cashiers create/send orders, receive payments, and record bill printing.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p
  ON p.`key` IN (
    'orders.create',
    'orders.read',
    'orders.send_to_kitchen',
    'payments.read',
    'payments.create',
    'bills.print'
  )
WHERE UPPER(r.`name`) = 'CASHIER';

-- Kitchen staff can view and manage kitchen tickets.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p
  ON p.`key` IN ('orders.read', 'kitchen.manage')
WHERE UPPER(r.`name`) = 'KITCHEN';

-- Waiters must not be able to record bill printing.
DELETE rp
FROM `RolePermission` rp
JOIN `Role` r ON r.`id` = rp.`roleId`
JOIN `Permission` p ON p.`id` = rp.`permissionId`
WHERE UPPER(r.`name`) = 'WAITER'
  AND p.`key` = 'bills.print';
