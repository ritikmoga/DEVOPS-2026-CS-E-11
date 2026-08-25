# Development and verification guide

This repository contains two Vite frontends and an Express API runtime.

## Local setup

From the repository root, install all dependencies with:

```bash
npm run install:all
```

The equivalent manual setup is:

```bash
cd frontend-demo/public-client
npm install

cd ../admin-client
npm install

cd ../../server
npm install
```

Copy `server/.env.example` to `server/.env` and start MongoDB as a replica set. The API uses MongoDB transactions for registration and attendance workflows.

Start the API and frontends in separate terminals:

```bash
cd server
npm start

cd frontend-demo/public-client
npm run dev

cd frontend-demo/admin-client
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

The backend verification validates the Prisma schema, checks every committed runtime JavaScript file with `node --check`, starts the API with an isolated test port, and confirms that `/health` returns a successful response. The health check does not require a running MongoDB instance.

Both GitHub Actions and Jenkins run these checks. Jenkins continues to publish the frontend JUnit/Markdown reports and now reports the combined result as `jenkins/full-stack`.
CI injects an isolated `DATABASE_URL` only for Prisma validation; it does not connect to or modify a real database.

## Backend source note

The current backend runtime is committed under `server/dist`. The repository should eventually restore the original TypeScript source and add a reproducible TypeScript build step. Until then, backend runtime edits must be reflected in `server/dist` so that `npm start` and CI execute the changed code.
