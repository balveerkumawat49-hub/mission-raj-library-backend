# Frontend Compatibility Report

This report documents the audit performed against the uploaded frontend
(`Library mission/`) and how the backend was built to match it exactly.

## How the contract was extracted

Every `apiRequest()` / `api()` call across these files was located and read
in context (path, HTTP method, request body, and how the response is
unwrapped by `normalizeStudent()`, `normalizeSettings()`, etc.):

`js/app.js`, `js/auth.js`, `owner/js/students.js`, `owner/js/onwer-dashboard.js`,
`owner/js/payments.js`, `owner/js/memberships.js`, `owner/js/notifications.js`,
`owner/js/attendance.js`, `owner/js/settings.js`, `owner/js/seats.js`,
`owner/js/seat-chart.js`, `owner/js/student-profile.js`, `student/js/membership.js`,
`student/js/notifications.js`, `student/js/attendance.js`, `student/js/profile.js`,
`student/js/dashboard.js`, `student/js/seat.js`, `student/js/fees.js`.

All of these already call a real backend at `API_BASE` (`window.MISSION_RAJ_API_BASE`,
default `http://127.0.0.1:5000`) with a Bearer token read from `localStorage`
(checked under several possible key names: `missionRajAccessToken`,
`missionRajToken`, `accessToken`, `access_token`, `token`), and unwrap responses
generously (`data`, `data.items`, or a few named array fields). This backend
returns the single consistent shape `{ success, message, data }` (`data.meta`
for pagination), which every one of those unwrap helpers accepts.

## The one required frontend change

**`js/auth.js` and `js/app.js` do not call the network at all.** They are
explicitly commented as a "Development Authentication Layer" that checks two
hardcoded demo accounts and fabricates a fake token
(`dev-owner-<timestamp>-<random>`) — `js/app.js` even has a comment marking
where it "will later become: `POST /api/auth/login`".

Per the master prompt's Section 4 ("Replace that behaviour at the backend
level without changing the frontend UI"), the **minimum necessary edit** was
made to exactly these two files:
- Same function names / exports (`login`, `logout`, `getSession`, `requireRole`, etc.) —
  nothing else in the frontend references internals that changed.
- Same HTML, same CSS, same DOM structure, same form ids — **zero UI change**.
- The only behavioral change: `login()` now calls `POST /api/auth/login`
  instead of checking a hardcoded array, and stores the **real** JWT pair
  returned by the backend under the same `localStorage` keys the rest of the
  app already reads from.

These two edited files are delivered **separately from the backend ZIP** (the
backend ZIP contains only the backend, per the master prompt's Section 35),
alongside a plain diff/description of the change, so they can be dropped
into the existing frontend folder in place of the originals.

No other frontend file was read for modification purposes — only for
contract extraction. No HTML/CSS was touched anywhere.

## Endpoint-by-endpoint matrix

| Frontend call site | Endpoint | Method | Backend route | Status |
|---|---|---|---|---|
| `js/auth.js` (rewritten) | `/api/auth/login` | POST | `auth.routes.js` | ✅ implemented |
| `owner/js/settings.js` | `/api/auth/change-password` | POST | `auth.routes.js` | ✅ implemented |
| (all pages, session check) | `/api/auth/me` | GET | `auth.routes.js` | ✅ implemented |
| `owner/js/students.js` | `/api/learners` | GET/POST | `learner.routes.js` | ✅ implemented |
| `owner/js/students.js`, `student-profile.js` | `/api/learners/:id` | GET/PATCH | `learner.routes.js` | ✅ implemented, RBAC-isolated |
| `student/js/profile.js` | `/api/learners/:id` | GET/PATCH (self, limited fields) | `learner.routes.js` | ✅ implemented |
| `owner/js/memberships.js`, `student/js/membership.js` | `/api/plans` | GET/POST | `plan.routes.js` | ✅ implemented |
| `owner/js/memberships.js` | `/api/plans/:id` | PATCH (edit + status toggle) | `plan.routes.js` | ✅ implemented |
| `owner/js/seats.js`, `seat-chart.js`, `student/js/seat.js` | `/api/seats` | GET/POST | `seat.routes.js` | ✅ implemented |
| `owner/js/seats.js` | `/api/seats/:id` | PATCH | `seat.routes.js` | ✅ implemented |
| `owner/js/students.js`, `seats.js`, `seat-chart.js` | `/api/seat-allocations` | GET/POST | `seatAllocation.routes.js` | ✅ implemented, transaction-guarded |
| `owner/js/students.js`, `seats.js` | `/api/seat-allocations/:seatId/release` | POST | `seatAllocation.routes.js` | ✅ implemented |
| `owner/js/attendance.js`, `student/js/attendance.js` | `/api/attendance` | GET/POST | `attendance.routes.js` | ✅ implemented, duplicate-checkin guarded |
| `owner/js/attendance.js` | `/api/attendance/:id/checkout` | POST | `attendance.routes.js` | ✅ implemented |
| `owner/js/payments.js`, `student/js/fees.js` | `/api/payments` | GET/POST | `payment.routes.js` | ✅ implemented |
| `student/js/fees.js` | `/api/payments/:id` | GET | `payment.routes.js` | ✅ implemented |
| `owner/js/notifications.js`, `student/js/notifications.js` | `/api/notifications` | GET/POST | `notification.routes.js` | ✅ implemented |
| `owner/js/notifications.js` | `/api/notifications/sent` | GET | `notification.routes.js` | ✅ implemented |
| `owner/js/notifications.js`, `student/js/notifications.js` | `/api/notifications/:id/read`, `/read-all` | PATCH | `notification.routes.js` | ✅ implemented |
| `owner/js/notifications.js` | `/api/notification-rules` | GET/POST/PATCH | `notificationRule.routes.js` | ✅ implemented |
| `owner/js/settings.js` | `/api/settings/library`, `/api/settings`, `/api/library-settings` | GET/PATCH/PUT | `settings.routes.js` | ✅ implemented (all 3 aliases) |
| `owner/js/onwer-dashboard.js` | `/api/dashboard/owner` | GET | `dashboard.routes.js` | ✅ implemented, real aggregation |

## What was tested vs. what needs to be run

Written and included: Jest + Supertest integration tests covering login
(valid/invalid), session (`/me`), password change + session revocation, RBAC
(student blocked from owner routes, student blocked from another student's
record), learner CRUD + validation, seat allocation (assign, duplicate
rejection, release), and attendance (check-in, duplicate rejection,
check-out).

**Not executed in the environment that built this backend** — no internet
access was available there to `npm install` any package or run a live
MongoDB. Every file was syntax-checked with `node --check`, but the actual
`npm install && npm run seed:owner && npm start && npm test` loop, and a
real end-to-end pass against the live frontend, still needs to be run in an
environment with internet access (i.e., your machine). Please run it and
report anything that fails.

## Remaining blockers / things to verify yourself

1. **CORS origin** — set `CORS_ORIGINS` in `.env` to match exactly how you serve
   the frontend (see README §3.3). If you open `index.html` directly from disk,
   keep `null` in the list.
2. **First run** — `npm install`, `npm run seed:owner`, `npm start`, then open the
   frontend and log in with the seeded owner credentials.
3. **Student accounts**: the audited frontend has no self-registration flow, so
   `POST /api/learners` auto-provisions a portal login (`loginId` = the email if
   given, else the mobile number) and a random one-time password, returned once
   in that response as `data.portalCredentials`. The owner needs to relay this to
   the student manually (the frontend does not currently display it anywhere -
   you may want a small UI addition to surface it after creating a student). If
   the frontend is meant to have a proper self-service signup flow instead,
   that wasn't found in the audited files — flag it and it can be added.
