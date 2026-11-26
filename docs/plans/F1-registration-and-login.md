# F1 — Registration and login

_Status: Approved · Last updated: 2026-11-26 · Spec: [F1-registration-and-login.md](../specs/features/F1-registration-and-login.md)_

## Summary
This plan scaffolds the monorepo (the app is not built yet), then builds the account feature in layers: the Prisma schema, pure account rules, password and token helpers, the auth service with fake repositories, Prisma adapters, logout and account deletion, the session guard, HTTP endpoints, and finally the web screens. No other feature is started. No shared work is reused from another plan; F1 is the first plan. The session guard built here is the login check that F2 and later features apply to each trip endpoint.

Two notes for review:
- F1.AC13 (cascade delete of trips, people, expenses and payments) cannot run until those tables exist (F2–F6). See the Decisions log.
- Schema migrations and authentication code need a person to read and approve them (project rules).

## Tasks

### F1.T1 Scaffold the monorepo
- **Files:** `package.json` (new, root with npm workspaces), `app/api/package.json` (new), `app/api/tsconfig.json` (new), `app/api/jest.config.ts` (new), `app/api/nest-cli.json` (new), `app/api/src/main.ts` (new), `app/api/src/app.module.ts` (new), `app/api/.env.example` (new), `app/web/package.json` (new), `app/web/tsconfig.json` (new), `app/web/jest.config.ts` (new), `app/web/src/app/layout.tsx` (new), `app/web/src/app/page.tsx` (new)
- **Does:** Sets up npm workspaces, TypeScript ~6.0, NestJS 12 with Jest 30 and ts-jest, and Next.js 16 (App Router) with React 19, Jest 30 and React Testing Library. Adds `.env.example` with `DATABASE_URL` and a session secret placeholder. The real `.env` is never committed (already ignored by `.gitignore`). Test scripts use `--passWithNoTests` so the empty suite passes.
- **Covers:** None. Setup for every task below.
- **Done when:** `npm install` and `npm test` exit 0, `npm run dev -w app/api` serves on port 3001, and `npm run dev -w app/web` serves on port 3000.

### F1.T2 Prisma schema and first migration
- **Files:** `app/api/prisma.config.ts` (new), `app/api/prisma/schema.prisma` (new), `app/api/prisma/migrations/<timestamp>_init_auth/migration.sql` (new, generated), `app/api/src/prisma/prisma.service.ts` (new, uses `@prisma/adapter-better-sqlite3`)
- **Does:** `User`: `id`, `email` (unique), `passwordHash`, `createdAt` (UTC). `Session`: `id`, `tokenHash` (unique), `userId` (foreign key to User, `onDelete: Cascade`), `createdAt`. No other columns. The session table stores the SHA-256 hash of the token, never the token.
- **Covers:** F1.R1 (unique email), F1.R4 (only the hash column exists for passwords)
- **Done when:** `npm run db:migrate -w app/api` applies the migration to an empty database without error. The unique constraints are checked in code review (see the coverage table).

### F1.T3 Account rules (pure domain)
- **Files:** `app/api/src/domain/account-rules.ts` (new), `app/api/src/domain/account-rules.spec.ts` (new)
- **Does:** `normalizeEmail` trims and lowercases. `isValidEmail` accepts one `@`, text on both sides, and a dot with text on both sides in the domain part. `checkPassword` counts Unicode code points (not bytes), accepts 8 to 128, does not trim, and returns the exact messages from the spec's States & errors table. No Nest or Prisma imports.
- **Covers:** F1.R1, F1.R2, F1.R3, F1.AC3, F1.AC4, F1.AC5
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(3|4|5)\b"` passes.

### F1.T4 Password hashing and session token helpers
- **Files:** `app/api/src/auth/password-hasher.ts` (new), `app/api/src/auth/password-hasher.spec.ts` (new), `app/api/src/auth/session-token.ts` (new), `app/api/src/auth/session-token.spec.ts` (new)
- **Does:** `PasswordHasher` port with `hash` and `verify`, implemented with `node:crypto` scrypt and a random 16-byte salt. The stored value is `salt:hash` in hex. `createSessionToken` returns 32 random bytes as base64url. `hashToken` returns the SHA-256 hex of a token.
- **Covers:** F1.R4, F1.R8 (token), F1.AC6 (real hasher), F1.AC9 (stored token is a hash)
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(6|9)\b"` passes.

### F1.T5 Register and login service (fake repositories)
- **Files:** `app/api/src/auth/auth.service.ts` (new), `app/api/src/auth/user.repository.ts` (new, interface), `app/api/src/auth/session.repository.ts` (new, interface), `app/api/src/auth/auth.service.spec.ts` (new)
- **Does:** `register`: normalize, validate, check for an existing email (duplicate returns the message and saves nothing), hash, save, create a session, return the user and token. `login`: normalize, validate, look up, verify; a wrong password and an unknown email return the same message and create no session. Services depend only on the repository interfaces.
- **Covers:** F1.R1, F1.R5, F1.R6, F1.R7, F1.R8, F1.AC1, F1.AC2, F1.AC6, F1.AC7, F1.AC8
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(1|2|6|7|8)\b"` passes.

### F1.T6 Prisma repositories
- **Files:** `app/api/src/auth/prisma-user.repository.ts` (new), `app/api/src/auth/prisma-session.repository.ts` (new), `app/api/src/auth/auth.module.ts` (new)
- **Does:** Implements the two repository interfaces with Prisma using parameterized calls only. Maps the unique-constraint error on `email` to the duplicate-email error, so two sign-ups at the same moment get the duplicate message. Wires the providers in `AuthModule`.
- **Covers:** F1.R5 (concurrent sign-up)
- **Done when:** `npm run build -w app/api` exits 0. The unique constraint and the error mapping are checked in code review (see the coverage table).

### F1.T7 Logout and account deletion
- **Files:** `app/api/src/auth/auth.service.ts` (changed), `app/api/src/auth/auth.service.spec.ts` (changed), `app/api/src/auth/unit-of-work.ts` (new, interface), `app/api/src/auth/prisma-unit-of-work.ts` (new)
- **Does:** `logout(token)` deletes the session row for the token hash. `deleteAccount(userId, password)` verifies the password first (wrong password returns the message and deletes nothing). Then one `$transaction` deletes the `User` row. Deleting the user removes everything else through database cascades: `Session` (already in T2), and each later table (`Trip`, `Person`, `Expense`, `Payment`) declares `onDelete: Cascade` back to `User` or `Trip`. No feature adds its own delete calls. SQLite foreign keys must be on for the cascades to run; code review checks this (see F1.AC13 in the coverage table). Logout and deletion use a `UnitOfWork` port (`deleteSessionByTokenHash`, `findUserById`, `deleteUser`), so the T5 repository ports stay unchanged. Wiring it into `AuthModule` is F1.T10.
- **Covers:** F1.R9, F1.R11, F1.AC9, F1.AC12, F1.AC13 (code review)
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(9|12)\b"` passes. Code review confirms the `Session` cascade works and that foreign keys are on for the app's SQLite connection.

### F1.T8 Account logging without secrets
- **Files:** `app/api/src/auth/auth-logger.ts` (new, port wrapping Nest `Logger`), `app/api/src/auth/auth.service.ts` (changed), `app/api/src/auth/auth.service.spec.ts` (changed)
- **Does:** The service logs register, login, failed login, logout and delete events with the user ID only. It never logs the password, the token, the token hash, or the email. A fake logger in the test records every call. Also: `deleteAccount` with an empty password returns "Enter your password to delete your account." with field `password`, and deletes nothing (left out of F1.T7).
- **Covers:** F1.R12, F1.AC15, F1.AC12 (empty password)
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(12|15)\b"` passes.

### F1.T9 Session guard and cookie options
- **Files:** `app/api/src/auth/session.guard.ts` (new), `app/api/src/auth/session.guard.spec.ts` (new), `app/api/src/auth/session-cookie.ts` (new), `app/api/src/auth/session-cookie.spec.ts` (new), `app/api/src/auth/session.repository.ts` (changed), `app/api/src/auth/prisma-session.repository.ts` (changed)
- **Does:** `SessionGuard` reads the cookie, hashes the token, looks up a valid session, and attaches `userId` to the request. No valid session returns 401 with no data, and the handler is not called. `sessionCookieOptions()` returns `HttpOnly`, `SameSite=Lax`, `Secure` when `NODE_ENV=production`, and no `Max-Age` or `Expires`. The guard provides `userId` to handlers; ownership checks belong to each trip query in F2+. Adds `findUserIdByTokenHash(tokenHash)` to the `SessionRepository` port and its Prisma adapter for the lookup. The guard reads the `session` cookie from the `Cookie` header itself (no `cookie-parser`), so `main.ts` does not change.
- **Covers:** F1.R8, F1.R10, F1.AC10, F1.AC11 (guard provides the rule; checked in code review later), F1.AC14
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(10|14)\b"` passes.

### F1.T10 HTTP endpoints
- **Files:** `app/api/src/auth/auth.controller.ts` (new), `app/api/src/auth/auth.controller.spec.ts` (new), `app/api/src/auth/auth.module.ts` (changed), `app/api/src/app.module.ts` (changed), `app/api/src/auth/auth.tokens.ts` (new), `app/api/src/auth/session.guard.ts` (changed), `app/api/src/auth/auth.service.ts` (changed)
- **Does:** `POST /register` (201, user `id` and `email`, cookie), `POST /login` (200, sets the session cookie), `POST /logout` (204, clears cookie, idempotent), `DELETE /account` (204, clears cookie; guarded, 401 when not logged in). The controller spec checks the login response sets the session cookie. Maps errors to the `{ error, field }` shape: 400 validation, 401 wrong credentials, 409 duplicate email, 500 generic message with no detail. Registers `AuthService`, the scrypt password hasher, `PrismaUnitOfWork` and `SessionGuard` as providers in `AuthModule`, and imports `AuthModule` in `AppModule`. All injection tokens (`USER_REPOSITORY`, `SESSION_REPOSITORY`, `PASSWORD_HASHER`, `UNIT_OF_WORK`, `AUTH_LOGGER`) move to `auth.tokens.ts`; `auth.module.ts` and `session.guard.ts` import them from there, so the module and the guard do not import each other. `AuthService` gets `@Injectable()` and an `@Inject(<token>)` on each constructor parameter; its logic does not change.
- **Covers:** F1.R6, F1.R7, F1.AC1 (HTTP response), F1.AC7 (login response sets the cookie)
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC(1|7)\b"` passes.

### F1.T11 Web API client and route rules
- **Files:** `app/web/src/lib/api-client.ts` (new), `app/web/src/lib/api-client.spec.ts` (new), `app/web/src/lib/route-rules.ts` (new), `app/web/src/lib/route-rules.spec.ts` (new), `app/web/src/lib/validation.ts` (new, client mirror of T3 rules), `app/web/src/lib/validation.spec.ts` (new)
- **Does:** `api-client` calls the endpoints with `credentials: 'same-origin'` and maps the error shape. A 401 sends the user to Log in with no message. `route-rules`: `routeFor(path, loggedIn)` redirects a logged-out visitor on any trip path to `/login`, and a logged-in visitor on `/login` or `/register` to `/trips`. `safeNextPath` accepts only in-app paths and falls back to `/trips`. `validation` gives fast client feedback. The server result always wins.
- **Covers:** F1.R10, F1.AC4 (client), F1.AC5 (client), F1.AC7 (safe post-login path), F1.AC10 (redirect)
- **Done when:** `npm test -w app/web -- -t "\bF1\.AC(4|5|7|10)\b"` passes.

### F1.T12 Current user endpoint
- **Files:** `app/api/src/auth/auth.controller.ts` (changed), `app/api/src/auth/auth.controller.spec.ts` (changed), `app/api/src/auth/auth.service.ts` (changed), `app/api/src/auth/auth.service.spec.ts` (changed)
- **Does:** `GET /me`, guarded by `SessionGuard`, returns 200 with the logged-in user's `id` and `email`, and never the password hash. `AuthService.currentUser(userId)` looks the user up with `UnitOfWork.findUserById`; if the user no longer exists it returns null and the controller answers 401 with no data. With no valid session the guard answers 401. The web app uses this to tell whether a visitor is logged in (the session cookie is HttpOnly) and to show the account email (F1.T13, F1.T14).
- **Covers:** F1.R10, F1.AC10 (no valid session gets 401 and no data)
- **Done when:** `npm test -w app/api -- -t "\bF1\.AC10\b"` passes.

### F1.T13 Register, log in and Trips placeholder screens
- **Files:** `app/web/src/components/auth-form.tsx` (new), `app/web/src/components/auth-form.test.tsx` (new), `app/web/src/app/register/page.tsx` (new), `app/web/src/app/login/page.tsx` (new), `app/web/src/app/trips/page.tsx` (new, placeholder until F2), `app/web/next.config.ts` (new, rewrites `/api/:path*` to `http://localhost:3001/:path*`), `app/web/src/lib/api-client.ts` (changed), `app/web/src/lib/api-client.spec.ts` (changed)
- **Does:** Register and Log in forms follow the spec's Accessibility section: visible labels, `autocomplete` values, `role="alert"` region, focus moves to the first invalid field after a failed submit, Enter submits, loading labels ("Creating account…", "Logging in…") with disabled buttons, email kept and password cleared on failure. Success goes to `/trips`. Adds `me()` to the API client (`GET /api/me`). The Trips placeholder calls `me()` on load, so a logged-out visitor is sent to `/login` by the client's 401 handling. The Register and Log in pages call `me()` on load and go to `/trips` when it succeeds (the logged-in rule in `route-rules`).
- **Covers:** F1.AC1, F1.AC4, F1.AC5, F1.AC8, F1.R2 (client)
- **Done when:** `npm test -w app/web -- -t "\bF1\.AC(1|4|5|8)\b"` passes, and `npm run dev -w app/web` lets a person register and log in against the API.

### F1.T14 Account page and header logout
- **Files:** `app/web/src/components/header.tsx` (new), `app/web/src/components/header.test.tsx` (new), `app/web/src/components/delete-account-form.tsx` (new), `app/web/src/components/delete-account-form.test.tsx` (new), `app/web/src/app/account/page.tsx` (new), `app/web/src/app/layout.tsx` (changed, mounts the header), `app/web/src/app/login/page.tsx` (changed)
- **Does:** Header with "Log out" on every logged-in screen (calls `/logout`, then shows the Log in screen) and a link to Account. Account page gets the email from `me()` and shows it with the two-step delete: password field, then the confirmation sentence and "Delete my account" button. Wrong password shows the message and stays on the page. Success goes to Log in with "Your account has been deleted." After a successful delete the app goes to `/login?deleted=1`, and the Log in page shows "Your account has been deleted." in its `role="status"` region when that query parameter is present.
- **Covers:** F1.AC9 (web logout), F1.AC12 (wrong password message; the success path has no AC of its own and is tested under F1.AC12)
- **Done when:** `npm test -w app/web -- -t "\bF1\.AC(9|12)\b"` passes.

### F1.T15 shadcn/ui setup
- **Files:** `app/web/package.json` (changed), `package-lock.json` (changed), `app/web/components.json` (new), `app/web/postcss.config.mjs` (new), `app/web/src/app/globals.css` (new), `app/web/src/app/layout.tsx` (changed, imports globals.css), `app/web/src/lib/utils.ts` (new, `cn` helper), `app/web/src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx` (new, from the shadcn CLI), `CLAUDE.md` (changed)
- **Does:** Installs Tailwind CSS v4 with `@tailwindcss/postcss` and initialises shadcn/ui in `app/web` with `npx shadcn@latest init` (neutral base colour, CSS variables, the existing `@/*` alias), then adds the button, input, label and card components with `npx shadcn@latest add`. Light theme only. Adds to CLAUDE.md under Stack: "Web UI: shadcn/ui components (in `app/web/src/components/ui/`) on Tailwind CSS v4. Screens use these components and Tailwind classes; labels, roles, aria attributes and copy come from the specs."
- **Covers:** None (presentation only).
- **Done when:** `npm test -w app/web` and `npm run build -w app/web` both pass with no test changed.

### F1.T16 Restyle F1 screens with shadcn/ui
- **Files:** `app/web/src/components/auth-form.tsx`, `header.tsx`, `delete-account-form.tsx` (changed), `app/web/src/app/login/page.tsx`, `register/page.tsx`, `account/page.tsx`, `layout.tsx` (changed)
- **Does:** Uses the shadcn Button, Input, Label and Card and Tailwind classes for a clean, centred layout that works at phone width. Presentation only: every label text, `id`/`htmlFor` pairing, `role`, `aria-*` attribute, message, button name, focus behaviour and loading label stays exactly as it is. No test file changes.
- **Covers:** None (presentation only).
- **Done when:** `npm test -w app/web` and `npm run build -w app/web` pass with no test changed.

## AC coverage

Every AC in the spec has one row. Unit tests only, per project rules. Two rows are "code review" (AC11 and AC13).

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F1.AC1 | `app/web/src/components/auth-form.test.tsx` | F1.AC1 successful registration goes to Trips | |
| F1.AC2 | `app/api/src/auth/auth.service.spec.ts` | F1.AC2 duplicate email saves nothing and shows the duplicate message | |
| F1.AC3 | `app/api/src/domain/account-rules.spec.ts` | F1.AC3 trims and lowercases the email before saving | |
| F1.AC4 | `app/api/src/domain/account-rules.spec.ts` | F1.AC4 rejects a missing `@`, a missing domain dot, and empty parts | |
| F1.AC5 | `app/api/src/domain/account-rules.spec.ts` | F1.AC5 rejects 7 and 129 characters, accepts 8 and 128 | |
| F1.AC6 | `app/api/src/auth/auth.service.spec.ts` | F1.AC6 saved password is a hash, not the typed password | |
| F1.AC7 | `app/api/src/auth/auth.service.spec.ts` and `app/api/src/auth/auth.controller.spec.ts` | F1.AC7 correct login creates a session (service spec); F1.AC7 login response sets the session cookie (controller spec) | |
| F1.AC8 | `app/api/src/auth/auth.service.spec.ts` | F1.AC8 wrong password and unknown email return the same message and create no session | |
| F1.AC9 | `app/api/src/auth/auth.service.spec.ts` | F1.AC9 logout ends the session so the old token finds nothing | |
| F1.AC10 | `app/api/src/auth/session.guard.spec.ts` | F1.AC10 no valid session: handler not called, no data returned | |
| F1.AC11 | code review | code review | Ownership check sits in database queries, and F1 has no trip queries yet. Check it at the first trip query in F2. |
| F1.AC12 | `app/api/src/auth/auth.service.spec.ts` | F1.AC12 wrong password deletes nothing | |
| F1.AC13 | code review | code review | Database cascades from User remove trips, people, expenses and payments. Those tables come in F2–F6, so this is checked after F6. Also check that SQLite foreign keys are on for the app's connection. See Decisions log. |
| F1.AC14 | `app/api/src/auth/session-cookie.spec.ts` | F1.AC14 cookie is HttpOnly with no Expires or Max-Age | |
| F1.AC15 | `app/api/src/auth/auth.service.spec.ts` | F1.AC15 register, login and delete log no password, session ID or token | |

Also checked in code review, supporting the rows above: the unique constraint on `User.email` (supports F1.AC2 under concurrent sign-up, F1.T2 and F1.T6), and session invalidation in the real Prisma session store (supports F1.AC9 and F1.AC13, F1.T6 and F1.T7).

## Out of scope
- Email verification and password reset (product.md Assumptions).
- Failed-login limits (Decisions log: out of scope for MVP).
- Changing a password, email or other account detail.
- "Remember me" or sessions longer than the browser session.
- Logging out other devices.
- Trip ownership checks on trip pages and actions (F2 onward). F1 provides the guard only.
- Display names or profiles.
- Trip content on the Trips page (placeholder until F2).
- Integration and end-to-end tests (project rules).

## Decisions log
- 2026-11-19: Stack and layout? → As set in CLAUDE.md: NestJS 12, Prisma 7.10 with SQLite via better-sqlite3, Next.js 16, Jest 30. Reason: CLAUDE.md fixes the stack, and the spec left it to the plan.
- 2026-11-19: Session storage? → Server-side `Session` row, random token in an HttpOnly cookie named `session`, only the SHA-256 of the token stored. Reason: CLAUDE.md conventions.
- 2026-11-19: Password hashing? → scrypt from `node:crypto`, random 16-byte salt, stored as `salt:hash`. Reason: CLAUDE.md conventions; no new dependency.
- 2026-11-19: Email and password rules location? → Pure functions in `app/api/src/domain/account-rules.ts`. A small client mirror in `app/web/src/lib/validation.ts` gives fast feedback. Reason: the spec asks for client checks, and the web package cannot import the API domain. The two copies must stay in sync; the server result wins.
- 2026-11-19: Password length counting? → Unicode code points (`[...password].length`). Reason: spec says characters, not bytes; the spec does not say whether combined emoji count as one, so a code point is the simplest reading.
- 2026-11-19: Endpoints and paths? → The spec's proposed paths, served under `/api` through Next rewrites, so the cookie stays same-origin. Reason: CLAUDE.md.
- 2026-11-19: Account deletion? → Database cascades only. `deleteAccount` verifies the password, then in one `$transaction` deletes the `User` row. Every table added later (`Trip`, `Person`, `Expense`, `Payment`) declares a foreign key with `onDelete: Cascade` back to `User` or `Trip`, so deleting the user removes all their data. No feature adds delete calls for account deletion. SQLite foreign keys must be on; code review checks this. F1.AC13 is checked in code review after F6. Reason: the spec puts F1 first, and the trip tables do not exist yet. Cascades keep deletion in one place as tables are added.
- 2026-11-19: Post-login destination and logged-in redirects? → Tested under F1.AC7 and F1.AC10. Reason: the spec's User flow describes them, but no AC names them.
- 2026-11-19: Schema migration and auth code? → Need a person to read and approve before merge. Reason: project rules list authentication and database migrations.
- 2026-11-19: Plan approved by the user, with the two edits above (cascade-only account deletion; F1.AC7 cookie test in the controller spec).
- 2026-11-25: F1.T7 extra methods? → A `UnitOfWork` port holds `deleteSessionByTokenHash`, `findUserById` and `deleteUser`. Reason: T7's Files list had no repository files; the developer agent stopped and asked. The T5 ports stay unchanged.
- 2026-11-25: SQLite foreign keys? → On by default with `@prisma/adapter-better-sqlite3`: `PRAGMA foreign_keys` returns 1, and deleting a user removed its sessions (checked on a copy of the dev database). `prisma.service.ts` needs no change. This is the code-review evidence for the cascade part of F1.AC13.
- 2026-11-25: Empty password on Delete account? → Added to F1.T8, which already changes `auth.service.ts`. Reason: the spec's message table has it, but F1.T7 left it out.
- 2026-11-25: Session lookup and cookie reading for the guard? → F1.T9 also changes the session repository port and adapter, and parses the `Cookie` header itself. F1.T10 wires all auth providers. Reason: found while reviewing F1.T7, so later tasks don't stop on missing files.
- 2026-11-25: Injection tokens and AuthService wiring? → Tokens live in `auth.tokens.ts`, and `AuthService` takes `@Inject` tokens, both in F1.T10. Reason: `session.guard.ts` imported its token from `auth.module.ts`, which becomes a circular import once the module registers the guard, and Nest cannot inject interface types without tokens.
- 2026-11-25: How does the web app know who is logged in? → New F1.T12 adds a guarded `GET /me` returning `id` and `email`; the old T12 and T13 become F1.T13 and F1.T14 and use it. Reason: the spec's Account page shows the email and the redirects need the logged-in state, but the cookie is HttpOnly and no endpoint returned the user. Found before T12 started, so no committed task changed its ID.
- 2026-11-25: Where does the "account deleted" message show? → F1.T14 also changes the Log in page, which reads `?deleted=1`. Reason: the message appears on the Log in screen (F1.T13's page), and found before T14 started.
- 2026-11-26: UI library? → shadcn/ui on Tailwind CSS v4, added as presentation-only tasks after the feature was built. Reason: the specs set behaviour, copy and accessibility but no visual design; adopting it before F3 means later features are built with it from the start.
