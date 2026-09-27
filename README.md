# Mission Raj Library — Backend

Production backend for the existing Mission Raj Library Management System
frontend. Built with **Node.js, Express, and MongoDB (Mongoose)**, with
JWT authentication, role-based access control, and full CRUD for every
module the frontend already calls.

This backend was built by auditing the frontend's JavaScript source
directly (every `apiRequest()`/`api()` call across `owner/js/*.js` and
`student/js/*.js`) to extract its exact API contract — endpoint paths,
HTTP methods, request bodies, and field names — rather than inventing a
new one. See [`FRONTEND_COMPATIBILITY_REPORT.md`](./FRONTEND_COMPATIBILITY_REPORT.md)
for the full endpoint-by-endpoint matrix and the one frontend change that
was necessary (wiring the login page to a real login call).

---

## 1. Tech stack

| Concern            | Choice                                    |
|---------------------|--------------------------------------------|
| Runtime             | Node.js 18+                                |
| Framework           | Express 4                                  |
| Database            | MongoDB via Mongoose                       |
| Auth                | JWT access + refresh tokens (rotated)      |
| Password hashing    | bcryptjs (12 salt rounds)                  |
| Validation          | express-validator                          |
| Security headers    | helmet                                     |
| Rate limiting       | express-rate-limit                         |
| Sanitization        | express-mongo-sanitize, hpp                |
| Logging             | winston + morgan                           |
| Tests               | Jest + Supertest + mongodb-memory-server   |

---

## 2. Project structure

```
library-backend/
├── src/
│   ├── config/        # env loading, MongoDB connection
│   ├── controllers/    # request handlers
│   ├── middleware/     # auth, RBAC, error handling, rate limiting, validation
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── services/        # business logic (seat allocation, attendance, audit log)
│   ├── utils/            # ApiError, ApiResponse, logger, JWT helpers
│   ├── validators/       # express-validator rule sets
│   ├── app.js             # Express app (middleware + routes)
│   └── server.js          # process entry point
├── scripts/
│   └── seedOwner.js        # safe, idempotent owner account seeding
├── tests/                   # Jest + Supertest integration tests
├── .env.example
├── package.json
└── README.md
```

---

## 3. Setup

### 3.1 Prerequisites
- Node.js 18 or newer
- A MongoDB instance — local (`mongod`), Docker, or a hosted cluster (e.g. MongoDB Atlas)

### 3.2 Install dependencies

```bash
cd library-backend
npm install
```

### 3.3 Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set, at minimum:
- `DATABASE_URL` — your MongoDB connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — long random strings. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `CORS_ORIGINS` — the origin(s) the frontend is served from. If you open the frontend
  directly from disk (double-clicking `index.html`), the browser sends `Origin: null`,
  so keep `null` in the list (it's included in `.env.example` by default). If you serve
  it with a local static server (e.g. VS Code "Live Server", or `npx serve`), add that
  origin too (e.g. `http://127.0.0.1:5500`).
- `SEED_OWNER_LOGIN_ID` / `SEED_OWNER_PASSWORD` — the first owner account's credentials

### 3.4 Start MongoDB

Any of:
```bash
# Local install
mongod --dbpath ./data

# Or Docker
docker run -d -p 27017:27017 --name library-mongo mongo:7
```

### 3.5 Seed the owner account

```bash
npm run seed:owner
```

This is **idempotent** — running it again when an owner already exists with that
`loginId` does nothing and never overwrites the existing password.

### 3.6 Start the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
NODE_ENV=production npm start
```

The API is now served at `http://127.0.0.1:5000` (or whatever `PORT` you set) —
which is exactly the base URL the frontend's `js/auth.js` / `owner/js/*.js` /
`student/js/*.js` already call by default.

Verify it's up:
```bash
curl http://127.0.0.1:5000/health
```

### 3.7 Point the frontend at the backend

No change needed if you're running on the default `http://127.0.0.1:5000` — the
frontend already targets that. To point at a different host/port, set this before
the frontend's scripts load (e.g. in `index.html`, or via browser console for testing):
```html
<script>window.MISSION_RAJ_API_BASE = "http://your-backend-host:PORT";</script>
```

---

## 4. Running tests

Tests spin up an **in-memory MongoDB** automatically (via `mongodb-memory-server`) —
no separate test database needed.

```bash
npm test
```

This covers: login (valid/invalid), `/api/auth/me`, password change + session
revocation, RBAC (student blocked from an owner-only route), learner CRUD +
validation, student-to-student data isolation, seat allocation (assign, duplicate
prevention, release), and attendance (check-in, duplicate check-in prevention,
check-out with duration calculation).

> **A note on this deliverable's own testing:** this codebase was written and
> syntax-checked (`node --check` on every file) inside a sandboxed environment
> with no internet access, so the actual `npm install` → start server → run
> these tests → hit real endpoints loop could not be executed there. Please run
> `npm install && npm test` after unpacking — if anything fails, share the
> output and it can be fixed.

---

## 5. Authentication

- **Access token**: short-lived JWT (default 15m), sent as `Authorization: Bearer <token>`.
- **Refresh token**: longer-lived JWT (default 30d), also stored server-side as a
  SHA-256 hash so it can be revoked. Rotated on every use (`POST /api/auth/refresh`).
- **Passwords**: hashed with bcrypt (12 rounds), never stored or logged in plaintext.
- **RBAC**: two roles, `owner` and `student`. Owner-only routes reject students with
  403. Learner-scoped routes (`/api/learners/:id` and similar) verify the
  authenticated student's id matches the resource, regardless of what id is in the URL.

| Endpoint | Method | Auth | Body | Notes |
|---|---|---|---|---|
| `/api/auth/login` | POST | none | `{ loginId, password, role? }` | Returns `{ accessToken, refreshToken, user, redirect }` |
| `/api/auth/refresh` | POST | none | `{ refreshToken }` | Rotates the refresh token |
| `/api/auth/logout` | POST | none | `{ refreshToken? }` | Revokes the given refresh token |
| `/api/auth/me` | GET | Bearer | — | Current user's profile |
| `/api/auth/change-password` | POST | Bearer | `{ currentPassword, newPassword }` | Revokes all other sessions |

---

## 6. Full endpoint reference

All responses use the envelope `{ success, message, data }` (list endpoints also
include `meta` for pagination). Errors use `{ success: false, message, error: { code, details? } }`.

| Module | Endpoint | Method | Role | Body / Query |
|---|---|---|---|---|
| Learners | `/api/learners` | GET | owner | `?search&status&membershipStatus&page&limit` |
| Learners | `/api/learners` | POST | owner | `{ name, mobile, email?, address?, admissionDate, membershipPlanId?, membershipStart?, membershipEnd?, totalFee?, paidFee?, paymentMode? }` |
| Learners | `/api/learners/:id` | GET | owner or self | — |
| Learners | `/api/learners/:id` | PATCH | owner or self | owner: any field above · student: `name, email, address, mobile` only |
| Plans | `/api/plans` | GET | owner, student | — |
| Plans | `/api/plans` | POST | owner | `{ name, durationValue, durationUnit, price, status?, description?, benefits? }` |
| Plans | `/api/plans/:id` | PATCH | owner | any subset of the above (also used for the activate/deactivate `{status}` toggle) |
| Seats | `/api/seats` | GET | owner, student | — |
| Seats | `/api/seats` | POST | owner | `{ seatNumber, floor?, zone?, status?, notes? }` |
| Seats | `/api/seats/:id` | PATCH | owner | any subset of the above |
| Seat allocations | `/api/seat-allocations` | GET | owner, student(own) | `?studentId&active=true` |
| Seat allocations | `/api/seat-allocations` | POST | owner | `{ seatId, studentId }` |
| Seat allocations | `/api/seat-allocations/:seatId/release` | POST | owner | — releases the seat's active allocation |
| Attendance | `/api/attendance` | GET | owner, student(own) | `?date&studentId` |
| Attendance | `/api/attendance` | POST | owner | `{ studentId }` — check-in |
| Attendance | `/api/attendance/:id/checkout` | POST | owner | — check-out |
| Payments | `/api/payments` | GET | owner, student(own) | `?studentId` |
| Payments | `/api/payments/:id` | GET | owner, student(own) | — |
| Payments | `/api/payments` | POST | owner | `{ studentId, amount, paymentMode, paymentDate, reference?, purpose?, note? }` |
| Notifications | `/api/notifications` | GET | owner, student(own) | `?studentId` |
| Notifications | `/api/notifications/sent` | GET | owner | — |
| Notifications | `/api/notifications` | POST | owner | `{ recipientType, recipientIds?, group?, type?, priority?, title, message, deliveryMode?, scheduledAt? }` |
| Notifications | `/api/notifications/:id/read` | PATCH | owner, student | — |
| Notifications | `/api/notifications/read-all` | PATCH | owner, student | `{ studentId? }` |
| Notification rules | `/api/notification-rules` | GET/POST/PATCH `:id` | owner | automation rule fields |
| Settings | `/api/settings/library`, `/api/settings`, `/api/library-settings` | GET/PATCH/PUT | owner (write), owner+student (read) | `{ library?, operating?, attendance?, membership?, payment?, notifications? }` |
| Dashboard | `/api/dashboard/owner` | GET | owner | real aggregated stats — see below |
| Health | `/health` | GET | none | `{ success, message }`, 503 if DB is disconnected |

Dashboard fields (all computed live from the database, never hardcoded):
`totalMembers, activeMembers, newMembers, expiredMembers, totalSeats, occupiedSeats,
availableSeats, reservedSeats, maintenanceSeats, blockedSeats, todayCollection,
monthCollection, pendingFees, renewalCollection, paymentCount, todayCheckins,
currentlyInside, expiringSoon`.

---

## 7. Security features

- Passwords hashed with bcrypt, never logged or returned in any response (`select: false` + `toJSON` stripping).
- JWT access + refresh tokens, refresh tokens stored server-side only as SHA-256 hashes, rotated on refresh, revoked on logout and on password change.
- Role-based access control on every route; per-resource ownership checks for learner-scoped data (a student changing the `:id` in a URL cannot read/edit another student's record — see `tests/learners.test.js`).
- `helmet` security headers, `express-mongo-sanitize` (NoSQL injection protection), `hpp` (HTTP parameter pollution protection).
- Rate limiting: general API limiter plus a tighter limiter specifically on `/api/auth/*`.
- Configurable CORS allow-list (`CORS_ORIGINS`), not a wildcard.
- Consistent error responses; stack traces are only logged server-side, never sent to clients.
- Request body size limits (1mb).
- No secrets committed to source; `.env` is git-ignored, `.env.example` has placeholders only.
- Race-condition safety on seat allocation and attendance check-in via MongoDB partial unique indexes (`SeatAllocation`: one active allocation per seat and per student; `Attendance`: one open check-in per student), with an optional-transaction wrapper used where the deployment supports multi-document transactions (replica sets / Atlas).
- Audit log (`AuditLog` collection) records actor, action, target, and timestamp for logins, learner/plan/seat/attendance/payment/notification/settings changes, and password changes.

---

## 8. Known limitations / honest caveats

- **Not run live in the environment that built it.** This code was written and
  syntax-validated (`node --check`) in a sandbox with no network access, so it could
  not actually be `npm install`'d, started, or hit with real HTTP requests there.
  Please run `npm install && npm run seed:owner && npm start` and `npm test` yourself;
  report back anything that fails.
- **Multi-document transactions** for seat allocation only take effect on a MongoDB
  replica set (including Atlas). A local standalone `mongod` falls back to
  non-transactional writes — still race-safe via unique indexes, just without the
  extra all-or-nothing guarantee across the seat + allocation documents.
- **Notification "group" targeting**: the frontend already resolves a selected
  group down to a concrete `recipientIds` array before sending (see
  `owner/js/notifications.js`), so the backend treats `recipientIds` as
  authoritative rather than re-resolving `group` itself.
- **Settings** nested groups beyond `library` (`operating`, `attendance`,
  `membership`, `payment`, `notifications`) are stored as flexible documents that
  echo back whatever the settings form sends, rather than a fully enumerated
  schema — the frontend's own settings page already tolerates this.
