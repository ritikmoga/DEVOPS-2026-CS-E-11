# EventFlow API map

Base path: `/api`

## Authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/auth/csrf` | Public | Issues a signed CSRF cookie and returns the matching request token |
| POST | `/auth/register` | Public | Creates an attendee account |
| POST | `/auth/login` | Public | Creates access and refresh cookies |
| POST | `/auth/refresh` | Refresh cookie | Rotates the refresh session |
| POST | `/auth/logout` | Any | Revokes current refresh session |
| POST | `/auth/logout-all` | Authenticated | Revokes every session and increments token version |
| GET | `/auth/me` | Authenticated | Returns the current user |
| POST | `/auth/verify-email` | Public | Verifies a one-time email token |
| POST | `/auth/forgot-password` | Public | Sends a reset link without account enumeration |
| POST | `/auth/reset-password` | Public | Replaces password and revokes all sessions |

All unsafe browser requests require `X-CSRF-Token`. The React Axios client obtains and retries this automatically.

## Events

| Method | Route | Access |
|---|---|---|
| GET | `/events` | Public |
| GET | `/events/slug/:slug` | Public |
| POST | `/events` | Organizer/Admin |
| GET | `/events/organizer/mine` | Organizer/Admin |
| GET | `/events/organizer/dashboard` | Organizer/Admin |
| GET | `/events/:id/manage` | Owner/Admin |
| PATCH | `/events/:id` | Owner/Admin |
| PATCH | `/events/:id/publish` | Owner/Admin |
| PATCH | `/events/:id/cancel` | Owner/Admin |
| DELETE | `/events/:id` | Owner/Admin, empty draft only |
| GET | `/events/:id/attendees` | Owner/Admin |
| GET | `/events/:id/export` | Owner/Admin |
| GET/POST | `/events/:id/staff` | Owner/Admin |
| DELETE | `/events/:id/staff/:userId` | Owner/Admin |
| GET | `/events/staff/assigned` | Staff/Organizer/Admin |

## Registrations and tickets

| Method | Route | Access |
|---|---|---|
| POST | `/registrations/events/:eventId` | Public or authenticated |
| GET | `/registrations/mine` | Authenticated |
| PATCH | `/registrations/:id/cancel` | Registration owner |
| PATCH | `/registrations/:id/organizer-cancel` | Event owner/Admin |
| GET | `/tickets/:publicCode?access=...` | Signed ticket-view link |
| POST | `/tickets/:ticketId/resend` | Event owner/Admin |
| PATCH | `/tickets/:ticketId/revoke` | Event owner/Admin |

## Check-in

| Method | Route | Access |
|---|---|---|
| POST | `/check-ins` | Assigned staff/Event owner/Admin |
| POST | `/check-ins/manual` | Assigned staff/Event owner/Admin |
| GET | `/check-ins/events/:eventId/recent` | Assigned staff/Event owner/Admin |

The QR contains a signed token, not attendee data. The ticket is consumed with a conditional `status: ACTIVE` update inside a MongoDB transaction, so duplicate simultaneous scans cannot both succeed.

## Administration and jobs

| Method | Route | Access |
|---|---|---|
| GET | `/admin/dashboard` | Admin |
| GET | `/admin/users` | Admin |
| PATCH | `/admin/users/:id/role` | Admin |
| PATCH | `/admin/users/:id/status` | Admin |
| POST | `/jobs/send-reminders` | `Authorization: Bearer JOB_SECRET` |
