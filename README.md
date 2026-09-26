# Sajha Cafe

Multi-tenant cafe management app. The active frontend is Next.js, the API is NestJS, and MySQL is accessed through Prisma.

## Requirements

- Node.js and npm
- A reachable MySQL 8 database (local, hosted, or containerized)

## Local setup

Install each app's dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

Configure the backend:

```bash
cp backend/.env.example backend/.env
```

Set `DATABASE_URL` to the MySQL runtime connection string and `DIRECT_DATABASE_URL` to the direct connection used for migrations. Both values use the `mysql://` scheme; replace any existing PostgreSQL/Supabase URLs in the ignored `backend/.env` file. The database must be reachable before the API starts. Apply the MySQL baseline and bootstrap role/permission migration, then generate the Prisma client. The TypeScript seed is optional for a fresh database and can be rerun for local role/permission updates:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

Configure the frontend if the API is not running at its default local address:

```bash
cp frontend/.env.example frontend/.env.local
```

Set `NEXT_PUBLIC_API_URL` to the backend origin. The default is `http://localhost:3000`.

Run the backend and frontend in separate terminals:

```bash
cd backend && npm run start:dev
```

```bash
cd frontend && npm run dev
```

- Frontend: <http://localhost:3001>
- API health: <http://localhost:3000/api/v1/health>

The health endpoint checks the database connection. The backend must remain running for login, POS, and bills to work.

## Run everything with Docker

If you would rather not install Node dependencies or MySQL locally, one command
starts MySQL, applies migrations, seeds an admin account, and serves the app:

```bash
docker compose up --build
```

No configuration file is required. Every value in `docker-compose.yml` has a
working default, and Compose reads a `.env` file next to it if you want to
override any of them.

| Service    | URL                            | Notes                                        |
| ---------- | ------------------------------ | -------------------------------------------- |
| Frontend   | <http://localhost:3001>        | log in here                                  |
| Backend    | <http://localhost:3000/api/v1> | Swagger UI at `/docs` outside production     |
| MySQL      | `127.0.0.1:3306/sajhacafe`     | user `cafe_user`, password `cafe_local_dev_pw` |

The default login is `admin@sajhacafe.test` / `sajhacafe123`, and
`SEED_DEMO_DATA` seeds six tables plus a starter menu so the POS is usable
immediately. Change `SEED_ADMIN_PASSWORD` before exposing this anywhere real.

Startup order is enforced with health checks: `migrate` waits for MySQL and runs
`prisma migrate deploy` followed by `scripts/seed-admin.ts`, then exits; the
backend waits for that to succeed; the frontend waits for the backend to report
healthy. Both seeding steps are idempotent, so restarts are safe.

```bash
docker compose up --build -d   # background
docker compose logs -f backend  # follow logs
docker compose down             # stop, keep data
docker compose down -v          # stop and delete the database volume
```

To go back to running the apps directly, stop the stack first so it releases the
ports: `docker compose down`.

### Container notes

- The frontend image bakes `NEXT_PUBLIC_API_URL` at build time, because Next.js
  inlines `NEXT_PUBLIC_*` values into the client bundle and `next.config.ts`
  reads the same variable for the `/api` rewrite. The browser only ever calls
  `/api` on the frontend origin; the rewrite proxies to `http://backend:3000`
  inside the Compose network. Changing the backend origin therefore needs a
  rebuild, not just a restart.
- `backend/Dockerfile` exposes two targets. `runner` is the lean runtime image
  the `backend` service uses. `builder` carries the full dependency tree and is
  what the one-shot `migrate` service runs in, because `prisma migrate deploy`
  needs the Prisma CLI and the seed needs `tsx` — both dev dependencies that are
  absent from the runtime image.
- The admin account is seeded by `backend/scripts/seed-admin.ts` rather than
  `npm run prisma:seed`, because `prisma/seed.ts` and `prisma/seed-user.sql`
  are both listed in `backend/.gitignore` and so are absent from a fresh clone.

## Cashier and waiter bills

- Waiters create orders and can view bills. Waiters do not have bill-print permission.
- Cashier POS lists open bills and refreshes the list every five seconds.
- Select an open bill in POS to see its current items, add configured menu items, send those additions to the kitchen, and print the updated combined bill.
- The cashier Bills page is the bill history. Open bills link back to POS; printing is done from POS.
- The backend records bills and orders in MySQL. Open table orders share one bill until settled.

After pulling schema changes, apply pending migrations from `backend/`; run the seed again when role or permission definitions change:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

See [backend/prisma/migrations/README.md](backend/prisma/migrations/README.md) for the MySQL migration workflow and review guidance. The previous PostgreSQL migration history is archived under `backend/prisma/postgresql-legacy/`; changing Prisma's provider does not copy existing PostgreSQL data, so migrate production data separately after taking a backup.

MySQL has no PostgreSQL-style row-level security. The application continues to scope database operations by tenant, and the archived `rls.sql` must not be run against MySQL.

## Project structure

- `frontend/app/` — Next.js routes and layouts
- `frontend/components/` — shared interface components
- `frontend/lib/` — API client and auth helpers
- `backend/src/` — NestJS API modules and services
- `backend/scripts/seed-admin.ts` — idempotent first-run admin and demo data seed
- `backend/prisma/` — MySQL schema, active migrations, and seed script
- `backend/prisma/postgresql-legacy/` — archived PostgreSQL migrations and RLS reference
- `frontend/legacy/vite/` — previous frontend retained for reference; it is not used by the active Next.js app
- `docker-compose.yml` — MySQL, backend, and frontend for local containerised runs

## Checks

```bash
cd frontend && npm run lint
cd backend && npm run lint
```

The backend `lint` script runs the TypeScript compiler with `--noEmit`. The
frontend `lint` script runs ESLint; `npx tsc --noEmit` there is also worth
running, because `next build` type-checks and will fail the Docker build on
errors that `next dev` tolerates.
