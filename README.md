# EventHub Platform

EventHub is a campus event, attendance, proof and certificate platform implemented with the requested stack:

- HTML5 and CSS3
- Vanilla JavaScript
- jQuery for DOM updates, routing events, forms and AJAX
- JSON for application and package configuration
- Node.js and Express for the API
- PostgreSQL with Prisma for relational persistence

## Applications

| Application              | Location                 | Port |
| ------------------------ | ------------------------ | ---: |
| Public EventHub site     | `frontend/public-client` | 5173 |
| Admin operations console | `frontend/admin-client`  | 5174 |
| Express API              | `server`                 | 5000 |
| PostgreSQL               | `compose.yaml`           | 5432 |

## Start locally

```bash
npm run install:all
docker compose up -d postgres
```

Copy `server/.env.example` to `server/.env`, then initialize and seed the database:

```bash
npm run db:migrate
npm run db:seed
npm run db:verify
```

Run these commands in three terminals:

```bash
npm run start:api
npm run dev:public
npm run dev:admin
```

For the first production administrator, set `BOOTSTRAP_ADMIN_EMAIL` and a 12+ character `BOOTSTRAP_ADMIN_PASSWORD` in `server/.env` before running `npm run db:seed`. No sample users, events, credentials, analytics, or mock API responses are included.

Run the complete project verification with `npm run verify`.

For a code-grounded architecture explanation, demo sequence, and review preparation, read [the project walkthrough](docs/PROJECT_WALKTHROUGH.md).
