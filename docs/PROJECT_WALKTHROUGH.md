# EventHub project walkthrough

This is a practical guide for explaining EventHub during a project review. It is based on the code in this repository; do not claim a feature that is not running in your local setup.

## 1. Problem statement

College event management is often split across forms, spreadsheets, QR screenshots, and manual certificate checks. EventHub keeps the main workflow in one system:

1. An organiser creates and publishes an event.
2. A student registers and receives a ticket after confirmation.
3. Check-in staff scan or enter the ticket to record attendance.
4. Admins review proofs, issue certificates, and inspect audit information.

The goal is not only event listing; it is to maintain a traceable path from registration to attendance and certificate eligibility.

## 2. Architecture in one minute

```text
Public client (5173)       Admin client (5174)
Vanilla JS + jQuery         Vanilla JS + jQuery
          \                  /
           \  REST API      /
            Express (5000)
                 |
      Prisma ORM + PostgreSQL (5432)
                 |
   Roles, events, registrations, tickets,
   attendance, proofs, certificates, audit logs
```

- `frontend/public-client`: student-facing event browsing, registration, ticket and dashboard flow.
- `frontend/admin-client`: event operations, attendance scanner, proof review, certificate and audit pages.
- `server/dist/src`: Express runtime, route validation, services and middleware.
- `server/prisma/schema.prisma`: relational database design.
- `Jenkinsfile` and `.github/workflows`: automated verification.

## 3. Important implementation decisions

### Role-based access control

The seed script creates permissions such as `EVENT_CREATE`, `ATTENDANCE_SCAN`, `PROOF_REVIEW`, and `CERTIFICATE_GENERATE`. Roles are mapped to permissions through the `RolePermission` table, rather than checking a role name everywhere in code. This makes permissions easier to extend later.

### Secure session design

On login, the API returns a short-lived access token and stores the refresh token in an HTTP-only cookie. Protected routes use authentication middleware and permission checks. Passwords are hashed with bcrypt; raw tickets are not stored in the database.

### Safe registration under concurrent requests

Registration uses a Prisma transaction. When approval is not required, the event seat count is incremented only if `confirmedCount < capacity`. This prevents two simultaneous registrations from both taking the final seat. A full event can place a student on the waitlist, and cancellation promotes the oldest waitlisted registration.

### QR attendance and location checks

A ticket token is hashed before lookup. Check-in validates that the ticket is active, belongs to the selected event, and that the event is currently active. If latitude, longitude and an allowed radius are configured, the server calculates the distance using the Haversine formula. Check-out derives attendance minutes and percentage, then marks the attendee `PRESENT` or `INCOMPLETE` according to the event threshold.

### Auditability

The database contains audit logs, login-audit support, proof status, certificate status and reason-required manual attendance overrides. These records are intended to make admin decisions reviewable rather than silently changing data.

## 4. Demo flow for review

Use this sequence only after PostgreSQL is running and the database has been migrated/seeded.

1. Start PostgreSQL with `docker compose up -d postgres`.
2. Create `server/.env` from `.env.example`, then run `npm run db:migrate` and `npm run db:seed`.
3. Start API, public client and admin client using the root commands from the README.
4. Sign in to the admin console and create an event with a capacity and registration window.
5. Publish the event. Show that a draft event is not available to public registration.
6. Create/sign in as a student and register. Explain the confirmed/waitlisted result based on capacity and approval settings.
7. Open the student dashboard and show the generated ticket.
8. Use the admin attendance page to validate/check in the ticket. Explain duplicate check-in and wrong-event protections.
9. Check out the attendee and show calculated attendance percentage.
10. Show the audit/proof/certificate pages as the post-event administration flow.

## 5. CI/CD explanation

GitHub Actions checks formatting, both frontend production builds, Prisma generation/schema validation, backend JavaScript syntax, and the `/health` endpoint. Jenkins performs the same pipeline on Windows, publishes the frontend reports, and reports to GitHub.

The Jenkins webhook needs an online Jenkins server. `tools/Keep-JenkinsWebhookOnline.ps1` is a Windows sign-in supervisor: it starts Jenkins, keeps a localhost.run tunnel alive, updates the GitHub webhook URL when the temporary tunnel changes, and restarts Jenkins if it becomes unavailable. GitHub sends `push` events to `/github-webhook/`, which triggers the Jenkins job; polling is a fallback.

## 6. Questions you should be ready for

| Question                                | Short answer                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why Prisma?                             | It gives a typed database client and migrations while keeping PostgreSQL as the actual relational store.                                             |
| Why use a transaction for registration? | Event capacity, registration creation and ticket creation must not partially succeed or race with another request.                                   |
| Why store a ticket hash?                | If the database is exposed, an attacker should not receive usable ticket tokens.                                                                     |
| Why two frontends?                      | Student actions and administrator operations have different permissions and workflows.                                                               |
| What happens if Jenkins is stopped?     | GitHub cannot wake an offline local computer. The sign-in supervisor keeps Jenkins/tunnel online after login, and Jenkins also polls as a fallback.  |
| What would you improve next?            | Add backend integration tests for registration/attendance states, persistent hosted Jenkins or a named tunnel, and object-storage integration tests. |

## 7. Honest limitations

- A localhost.run URL is temporary; the supervisor updates GitHub when it changes, but the laptop must be powered on and signed in.
- The verification health check does not exercise a real PostgreSQL transaction; database workflow testing needs a running test database.
- Email and storage providers are environment-driven and need real provider credentials for production delivery.
