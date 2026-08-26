# Development and verification guide

This repository contains two vanilla HTML/CSS/JavaScript/jQuery frontends, an Express JavaScript API runtime, and a PostgreSQL database managed through Prisma.

## Local setup

From the repository root, install all dependencies with:

```bash
npm run install:all
```

The equivalent manual setup is:

```bash
cd frontend/public-client
npm ci

cd ../admin-client
npm ci

cd ../../server
npm ci
```

Copy `server/.env.example` to `server/.env`, start PostgreSQL, and apply the committed SQL migration. The default local credentials match `compose.yaml`:

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

The API uses PostgreSQL transactions for registration, ticket, attendance and certificate workflows.

Start the API and frontends in separate terminals:

```bash
cd server
npm start

cd frontend/public-client
npm run dev

cd frontend/admin-client
npm run dev
```

The public frontend runs on port `5173`, the admin frontend on port `5174`, and the API on port `5000`.

The root helper commands are:

```bash
npm run dev:public
npm run dev:admin
npm run verify
```

## Verification commands

Frontend checks:

```bash
node ci/verify-frontends.mjs
```

Backend checks:

```bash
cd server
# First copy .env.example to .env, or export DATABASE_URL in your shell.
npm run verify
```

The backend verification validates the PostgreSQL Prisma schema, checks every committed runtime JavaScript file with `node --check`, starts the API with an isolated test port, and confirms that `/health` returns a successful response. The health check does not require a running PostgreSQL instance.

Both GitHub Actions and Jenkins run these checks. Jenkins continues to publish the frontend JUnit/Markdown reports and now reports the combined result as `jenkins/full-stack`.
CI injects an isolated `DATABASE_URL` only for Prisma validation; it does not connect to or modify a real database.

## Source layout

- Public browser app: `frontend/public-client/src/app.js`
- Admin browser app: `frontend/admin-client/src/app.js`
- API runtime: `server/dist/src/*.js`
- PostgreSQL data model: `server/prisma/schema.prisma`
- SQL migration: `server/prisma/migrations/0001_postgresql_baseline/migration.sql`

The backend is intentionally maintained as JavaScript under `server/dist`, which is also the directory executed by `npm start` and CI.
