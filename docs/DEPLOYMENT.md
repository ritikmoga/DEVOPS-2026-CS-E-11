# Production deployment

## Recommended topology

- React/Vite client: Vercel or static Nginx
- Express API: Render, Railway, Fly.io or a managed container platform
- Database: MongoDB Atlas replica-set deployment
- Email: verified SMTP provider
- Reminder execution: platform cron job once per hour

## MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user with only the permissions required for the EventFlow database.
3. Add the API platform's outbound network range. Avoid `0.0.0.0/0` when a narrower rule is available.
4. Copy the SRV URI into `MONGO_URI`.
5. Do not append `directConnection=true`; transactions need replica-set routing.

## API deployment

Set every variable shown in `server/.env.example`. Generate secrets independently, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

When client and API use separate sites, set:

```env
COOKIE_SAME_SITE=none
NODE_ENV=production
CLIENT_URL=https://your-client.example
CORS_ORIGINS=https://your-client.example
```

Both origins must use HTTPS. For a single parent domain such as `app.example.com` and `api.example.com`, test whether `lax` meets the browser flow before selecting `none`.

## Client deployment

Set `VITE_API_URL` before the Vite build:

```env
VITE_API_URL=https://api.example.com/api
```

The included `client/vercel.json` preserves React Router paths. Update the API's `CLIENT_URL` and `CORS_ORIGINS` after the frontend URL is known.

## SMTP

Use a verified sending identity. Configure SPF, DKIM and DMARC. Test confirmation, password reset, cancellation and reminder messages before opening registration.

## Reminder jobs

Use either:

- `npm run jobs:reminders` in an hourly platform cron job, or
- `ENABLE_INTERNAL_CRON=true` for a continuously running API service.

Do not enable both, or the deduplication log will perform unnecessary duplicate checks. Email logs prevent the same 24-hour reminder from being sent twice.

## First administrator

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run:

```bash
npm run seed:admin
```

Change the password after the first successful sign-in and remove the password from deployment configuration if it is no longer needed.
