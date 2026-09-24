# Prisma migration workflow

The repository includes the generated foundation migration at
`00000000000000_multi_tenant_foundation/migration.sql`. It represents the current
shared-schema, tenant-aware Prisma schema from an empty database. Review it against
a Supabase staging backup before applying it to an environment containing data.

From `backend/`:

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

For production, review the generated SQL, run it against a restored staging backup,
and deploy with:

```bash
npx prisma migrate deploy
```

Apply `../rls.sql` only after the application tenant context and its isolation tests are passing. The application must set `app.tenant_id` inside tenant-scoped transactions before RLS is relied on.
