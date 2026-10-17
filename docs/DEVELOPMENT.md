# Development and verification guide

This repository contains two vanilla HTML/CSS/JavaScript/jQuery frontends, an Express JavaScript API runtime, and a MongoDB database managed through Prisma.

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

Copy `server/.env.example` to `server/.env`, start MongoDB, and push the Prisma schema. The default local credentials match `compose.yaml`:

```bash
docker compose up -d mongodb mongodb-init
npm run db:push
npm run db:seed
```

The API uses MongoDB multi-document transactions for registration, ticket, attendance and certificate workflows. Those transactions require a replica set, which is why `compose.yaml` starts `mongod --replSet rs0` and runs the one-shot `mongodb-init` service to initiate the set. Point `DATABASE_URL` at a replica-set-capable deployment (`?replicaSet=rs0`) in any other environment.

The replica set is published as `localhost:27017` because the API is started on the host. `mongodb-init` therefore connects with `directConnection=true`; a replica-set aware client inside that container would otherwise be told to reach the member on its own `localhost`.

### MongoDB behaviour that differs from PostgreSQL

Two differences from the previous PostgreSQL setup are worth knowing before changing data access code.

**1. `where: { field: null }` does not match an absent field.**

Prisma's MongoDB connector compiles that filter to `{ $expr: { $and: [{ $eq: ["$field", null] }, { $ne: ["$field", "$$REMOVE"] }] } }`. The `$$REMOVE` guard skips documents where the field was never written, and Prisma omits unset nullable fields on insert. On PostgreSQL the same filter is a plain `IS NULL`, which does match.

That makes every soft-delete (`deletedAt`), revocation (`revokedAt`, `usedAt`) and unread-notification (`readAt`) lookup silently return nothing rather than fail loudly. `createPrismaClient` in `server/dist/src/prisma-client.js` writes those nulls explicitly on create. Use that factory instead of `new PrismaClient()` in new code. It only covers top-level writes, because Prisma does not route nested relation creates through the extension — `NotificationRecipient` therefore sets its nulls at its call site in `notification.service.js`.

**2. Concurrent writes to one document abort the whole transaction.**

MongoDB uses snapshot isolation, so two transactions updating the same document fail with `P2034` ("write conflict or deadlock") rather than queueing the way a PostgreSQL row lock does. The contended documents here are the shared `Event.confirmedCount` seat counter and the shared `SequenceCounter` key, so a burst of simultaneous registrations collides.

`withTransaction` in `server/dist/src/prisma-client.js` retries these with exponential backoff and jitter, and every service uses it in place of a bare `prisma.$transaction`. Use it for any interactive transaction that writes a shared document. `P2034` carries MongoDB's `TransientTransactionError` label, which means the correct response is to retry the whole transaction, not to catch it — the callbacks re-read their state at the start of each attempt, so re-running them is safe.

Read-only batches (`prisma.$transaction([...])` around `findMany`/`count`) are unaffected and can stay as they are.

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

The backend verification validates the MongoDB Prisma schema, checks every committed runtime JavaScript file with `node --check`, starts the API with an isolated test port, and confirms that `/health` returns a successful response. The health check does not require a running MongoDB instance.

Both GitHub Actions and Jenkins run these checks. Jenkins continues to publish the frontend JUnit/Markdown reports and now reports the combined result as `jenkins/full-stack`.
CI injects an isolated `DATABASE_URL` only for Prisma validation; it does not connect to or modify a real database.

## Source layout

- Public browser app: `frontend/public-client/src/app.js`
- Admin browser app: `frontend/admin-client/src/app.js`
- API runtime: `server/dist/src/*.js`
- MongoDB data model: `server/prisma/schema.prisma`
- Prisma client factory and transaction retry: `server/dist/src/prisma-client.js`
- Schema application: `npm run db:push` (Prisma `db push`; MongoDB has no SQL migration history)

The backend is intentionally maintained as JavaScript under `server/dist`, which is also the directory executed by `npm start` and CI.
