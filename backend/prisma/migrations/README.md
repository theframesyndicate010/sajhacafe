# Prisma migration workflow

The active migration history targets MySQL 8. The baseline migration creates the current schema from an empty database:

`20260925060000_mysql_baseline/migration.sql`

The old PostgreSQL migrations and PostgreSQL-only RLS script are preserved in `../postgresql-legacy/` for reference. They must not be applied to MySQL.

## Local setup

From `backend/`:

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate deploy
# Optional: re-apply the TypeScript seed for local role/permission updates
npm run prisma:seed
```

`DATABASE_URL` is used by the application. `DIRECT_DATABASE_URL` is used by Prisma for migrations; both must use `mysql://` URLs. The active MySQL migrations include the initial roles, permissions, and grants, so a fresh database does not require a separate seed step.

## Development and production

Create a new migration after changing `schema.prisma`:

```bash
npx prisma migrate dev --name describe_the_change
```

Review generated SQL before deploying it. Production deployments should use:

```bash
npx prisma migrate deploy
```

The baseline is intended for a new MySQL database. It does not copy data from PostgreSQL. Export and transform an existing PostgreSQL backup separately, then verify UUID strings, JSON values, timestamps, and auto-increment counters after import. In particular, advance `Bill` and `InventorySkuSequence` auto-increment values past the imported data.

MySQL does not provide PostgreSQL row-level security. Tenant isolation remains enforced by the application’s tenant-scoped Prisma queries; do not apply the archived `rls.sql` to MySQL. MySQL also has no PostgreSQL partial indexes; the table-row locks in the order and payment services must remain in place to serialize open-bill creation.
