# Sajha Cafe

Multi-tenant cafe management app. The active frontend is Next.js, the API is NestJS, and PostgreSQL is accessed through Prisma.

## Requirements

- Node.js and npm
- A reachable PostgreSQL database (Supabase is supported)

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

Set `DATABASE_URL` to the runtime connection string and `DIRECT_DATABASE_URL` to the direct/session connection used for migrations. The database must be reachable before the API starts. Apply migrations and generate the Prisma client:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
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

## Cashier and waiter bills

- Waiters create orders and can view bills. Waiters do not have bill-print permission.
- Cashier POS lists open bills and refreshes the list every five seconds.
- Select an open bill in POS to see its current items, add configured menu items, send those additions to the kitchen, and print the updated combined bill.
- The cashier Bills page is the bill history. Open bills link back to POS; printing is done from POS.
- The backend records bills and orders in PostgreSQL. Open table orders share one bill until settled.

After pulling schema or role changes, apply pending migrations from `backend/`:

```bash
npx prisma migrate deploy
```

See [backend/prisma/migrations/README.md](backend/prisma/migrations/README.md) for the database migration workflow and review guidance.

## Project structure

- `frontend/app/` — Next.js routes and layouts
- `frontend/components/` — shared interface components
- `frontend/lib/` — API client and auth helpers
- `backend/src/` — NestJS API modules and services
- `backend/prisma/` — database schema, migrations, and seed
- `frontend/legacy/vite/` — previous frontend retained for reference; it is not used by the active Next.js app

## Checks

```bash
cd frontend && npm run lint
cd backend && npm run lint
```

The backend `lint` script runs the TypeScript compiler with `--noEmit`.
