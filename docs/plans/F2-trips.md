# F2 — Trips

_Status: Approved · Last updated: 2026-11-19 · Spec: [F2-trips.md](../specs/features/F2-trips.md)_

## Summary
This plan adds the trips feature on top of F1 (build order step 2). It adds the `Trip` table, pure name rules and newest-first sorting, a repository with ownership in every query, a service tested with fake repositories, the trip endpoints behind F1's session guard, and the web screens: the Trips page with the new-trip form and list, and the trip page.

Shared work reused from F1, not planned again: the scaffold (F1.T1), the Prisma service and `User` model (F1.T2), the `SessionGuard` that gives `userId` to handlers (F1.T9), the web API client and route rules that send logged-out visitors to Log in (F1.T11). F2.T9 replaces the placeholder Trips page from F1.T13.

Two notes for review:
- F2.T2 adds a database migration. A person must read and approve it (project rules).
- F2.AC10 (cascade delete of people, expenses and payments) cannot be checked until F3–F6 add those tables. F2.T2 only sets the cascade from `User`, as F1.AC13 expects.

## Tasks

### F2.T1 Trip name rules and newest-first sort (pure domain)
- **Files:** `app/api/src/domain/trip-rules.ts` (new), `app/api/src/domain/trip-rules.spec.ts` (new)
- **Does:** `normalizeTripName` trims leading and trailing spaces. `checkTripName` counts characters (code points) of the trimmed name: empty returns `name_required`, more than 100 returns `name_too_long`, otherwise it passes. `sortNewestFirst` orders trips by `createdAt` descending, with ties broken by `id` descending. No Nest or Prisma imports.
- **Covers:** F2.R1, F2.R2, F2.R6, F2.AC2, F2.AC3, F2.AC4, F2.AC6
- **Done when:** `npm test -w app/api -- -t "\bF2\.AC(2|3|4|6)\b"` passes.

### F2.T2 Trips table and migration
- **Files:** `app/api/prisma/schema.prisma` (changed: new `Trip` model, `User` gets `trips Trip[]`), `app/api/prisma/migrations/<timestamp>_add_trips/migration.sql` (new, generated)
- **Does:** `Trip`: `id` (uuid string, primary key), `userId` (foreign key to `User`, `onDelete: Cascade`), `name` (text, required), `createdAt` (UTC, set on insert). `@@index([userId])`. No unique constraint on `name`. Person, expense and payment tables come in F3–F6.
- **Covers:** F2.R3, F2.R5, F2.AC14 (code review)
- **Done when:** `npm run db:migrate -w app/api` applies the migration to an empty database and exits 0, and `npm run build -w app/api` exits 0. Code review checks the index, the cascade and the missing name constraint (see the coverage table).

### F2.T3 Trip repository interface and Prisma adapter
- **Files:** `app/api/src/trips/trip.repository.ts` (new, interface), `app/api/src/trips/prisma-trip.repository.ts` (new)
- **Does:** Interface `TripRepository` with `create(userId, name)`, `listByOwner(userId)`, `findByIdForOwner(userId, id)` and `deleteForOwner(userId, id)`, which returns whether a row was removed. The Prisma version uses parameterized calls only. Every read and delete filters on `id` and `userId` together. The list is ordered by `createdAt` descending. A malformed ID matches no row and returns nothing, not an error.
- **Covers:** F2.R8, F2.AC11 (code review of the queries)
- **Done when:** `npm run build -w app/api` exits 0. Code review checks that each query filters on `userId` (see the coverage table).

### F2.T4 Trips service with fake repositories
- **Files:** `app/api/src/trips/trips.service.ts` (new), `app/api/src/trips/trips.service.spec.ts` (new)
- **Does:** `create`, `list`, `get` and `delete` take the session's user ID. `create` runs `checkTripName`, throws `TripError` with the code on failure, and saves the trip with the session user as owner. `list` returns `id`, `name` and `createdAt` only, newest first. `get` and `delete` throw `not_found` when the repository finds nothing for that owner. `delete` calls the repository once with the trip ID and owner. Tests use an in-memory fake `TripRepository`. Services depend only on the interface.
- **Covers:** F2.R1, F2.R2, F2.R3, F2.R5, F2.R6, F2.R7, F2.R9, F2.AC1, F2.AC5, F2.AC6, F2.AC7, F2.AC9, F2.AC11
- **Done when:** `npm test -w app/api -- -t "\bF2\.AC(1|5|6|7|9|11)\b"` passes.

### F2.T5 Trip logging without names or tokens
- **Files:** `app/api/src/trips/trip-logger.ts` (new, port wrapping Nest `Logger`), `app/api/src/trips/trips.service.ts` (changed), `app/api/src/trips/trips.service.spec.ts` (changed)
- **Does:** The service logs create, list, not-found and delete events with the user ID and trip ID only. It never logs the trip name or the session token. A fake logger in the test records every call.
- **Covers:** F2.AC15
- **Done when:** `npm test -w app/api -- -t "\bF2\.AC15\b"` passes.

### F2.T6 Trip endpoints behind the session guard
- **Files:** `app/api/src/trips/trips.controller.ts` (new), `app/api/src/trips/trips.controller.spec.ts` (new), `app/api/src/trips/trips.module.ts` (new, provides `TripRepository` with the Prisma adapter and the service, and uses F1's guard), `app/api/src/app.module.ts` (changed, imports `TripsModule`)
- **Does:** `@Controller('trips')` with `SessionGuard` on the class, so every route is guarded. Routes: GET `/trips` (200), POST `/trips` (201), GET `/trips/:id` (200), DELETE `/trips/:id` (204). The owner always comes from the guard's `userId`. The body is read for `name` only. `TripError` maps to `{ "error": code }`: 400 for name errors, 404 for `not_found`. No PUT or PATCH route exists, so names cannot change (R10).
- **Covers:** F2.R5, F2.R8, F2.R10, F2.AC12, F2.AC13
- **Done when:** `npm test -w app/api -- -t "\bF2\.AC(12|13)\b"` passes.

### F2.T7 Web name rules and trip API client
- **Files:** `app/web/src/lib/trip-validation.ts` (new, client mirror of the name rules), `app/web/src/lib/trip-validation.spec.ts` (new), `app/web/src/lib/api-client.ts` (changed: `listTrips`, `createTrip`, `getTrip`, `deleteTrip`), `app/web/src/lib/api-client.spec.ts` (changed)
- **Does:** The client mirror gives the same messages as the spec for fast feedback. The server result always wins. The trip client methods use `credentials: 'same-origin'` (F1.T11) and return the server's `error` code.
- **Covers:** F2.R2 (client), F2.AC1, F2.AC3, F2.AC4, F2.AC6, F2.AC9, F2.AC11 (client calls)
- **Done when:** `npm test -w app/web -- -t "\bF2\.AC(1|3|4|6|9|11)\b"` passes.

### F2.T8 New trip form
- **Files:** `app/web/src/components/new-trip-form.tsx` (new), `app/web/src/components/new-trip-form.test.tsx` (new)
- **Does:** Visible label "Trip name" and a "Create trip" button. The empty and too-long messages show under the field and are linked to it with `aria-describedby`. An invalid submit sends no request. Success clears the field, shows "Trip created." in a polite live region, and calls `onCreated` with the new trip. Failure shows "Could not create the trip. Try again." and keeps the typed name. The button is disabled while the request is in flight.
- **Covers:** F2.AC1 (form), F2.AC3, F2.AC4
- **Done when:** `npm test -w app/web -- -t "\bF2\.AC(1|3|4)\b"` passes.

### F2.T9 Trip list, delete confirmation and Trips page
- **Files:** `app/web/src/components/trip-list.tsx` (new), `app/web/src/components/trip-list.test.tsx` (new), `app/web/src/app/trips/page.tsx` (changed, replaces F1's placeholder), `app/web/src/app/trips/page.test.tsx` (new)
- **Does:** While loading, shows "Loading your trips…". With no trips, shows "You have no trips yet. Create one above to get started." Otherwise each row shows the name (a link to `/trips/:id`) and a Delete button named "Delete trip <name>". Delete opens a panel on that row with the confirmation sentence and "Cancel" first, then "Delete trip". The panel takes focus when it opens. Escape closes it. Cancel closes it and sends no request. Confirmed delete removes the row and shows "Trip deleted." A failed delete shows "Could not delete the trip. Try again." and keeps the row. After a delete, focus goes to the list heading, or to the empty-state message if the list is now empty. The Trips page shows the form above the list.
- **Covers:** F2.R6, F2.R7, F2.AC6, F2.AC7, F2.AC8, F2.AC9
- **Done when:** `npm test -w app/web -- -t "\bF2\.AC(6|7|8|9)\b"` passes.

### F2.T10 Trip page and not-found state
- **Files:** `app/web/src/app/trips/[id]/page.tsx` (new), `app/web/src/app/trips/[id]/page.test.tsx` (new)
- **Does:** Loads the trip with GET `/trips/:id` and shows only its name and a "Back to trips" link. On 404 it shows "This trip could not be found." with the same link, which covers both missing trips and other users' trips. Logged-out visitors are redirected by F1's route rules (F1.T11), so this page adds no redirect.
- **Covers:** F2.R9, F2.AC11
- **Done when:** `npm test -w app/web -- -t "\bF2\.AC11\b"` passes.

## AC coverage

Every AC in the spec has one row. Two rows are "code review" (AC10 and AC14). Two more rows, AC11 and AC12, have a unit test and also need a code review check, noted below the table.

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F2.AC1 | `app/api/src/trips/trips.service.spec.ts` and `app/web/src/components/new-trip-form.test.tsx` | F2.AC1 saves "Lisbon" with the session user as owner; F2.AC1 a saved trip clears the field and is reported to the list | |
| F2.AC2 | `app/api/src/domain/trip-rules.spec.ts` | F2.AC2 trims leading and trailing spaces before save | |
| F2.AC3 | `app/api/src/domain/trip-rules.spec.ts` and `app/web/src/components/new-trip-form.test.tsx` | F2.AC3 rejects empty and spaces-only names; F2.AC3 empty name shows "Enter a trip name." and sends no request | |
| F2.AC4 | `app/api/src/domain/trip-rules.spec.ts` and `app/web/src/components/new-trip-form.test.tsx` | F2.AC4 rejects 101 characters and accepts 100; F2.AC4 101 characters shows the limit message and sends no request | |
| F2.AC5 | `app/api/src/trips/trips.service.spec.ts` | F2.AC5 two trips with the same name are both saved and listed | |
| F2.AC6 | `app/api/src/domain/trip-rules.spec.ts`, `app/api/src/trips/trips.service.spec.ts` and `app/web/src/components/trip-list.test.tsx` | F2.AC6 sorts newest first; F2.AC6 lists only the session user's trips with name only; F2.AC6 rows show only the name | |
| F2.AC7 | `app/api/src/trips/trips.service.spec.ts` and `app/web/src/components/trip-list.test.tsx` | F2.AC7 no trips returns an empty array; F2.AC7 no trips shows the empty-state message and no rows | |
| F2.AC8 | `app/web/src/components/trip-list.test.tsx` | F2.AC8 Cancel closes the panel, sends no delete request and keeps the trip listed | |
| F2.AC9 | `app/api/src/trips/trips.service.spec.ts` and `app/web/src/components/trip-list.test.tsx` | F2.AC9 confirmed delete calls the repository once with trip ID and owner; F2.AC9 confirmed delete removes the row and shows "Trip deleted." | |
| F2.AC10 | code review | code review | Cascade delete of people, expenses and payments runs in the database. Those tables come in F3–F6, so check it after F6. Also check that SQLite foreign keys are on (F1.T7). |
| F2.AC11 | `app/api/src/trips/trips.service.spec.ts` and `app/web/src/app/trips/[id]/page.test.tsx` | F2.AC11 other user's trip returns not_found and changes nothing (service); F2.AC11 other user's trip shows "This trip could not be found." (page) | |
| F2.AC12 | `app/api/src/trips/trips.controller.spec.ts` | F2.AC12 every trip route is behind the session guard | |
| F2.AC13 | `app/api/src/trips/trips.controller.spec.ts` | F2.AC13 an owner in the request body is ignored | |
| F2.AC14 | code review | code review | Database constraint: `trips.name` has no unique index. Check in the migration. |
| F2.AC15 | `app/api/src/trips/trips.service.spec.ts` | F2.AC15 create, list and delete log no trip name and no session token | |

Code review also needed for two unit-tested rows:
- **F2.AC11:** the Prisma queries in `prisma-trip.repository.ts` filter on `userId` in every read and delete (F2.T3). The fake repository test cannot prove this.
- **F2.AC12:** a real request with no session gets 401 from the running server.

## Out of scope
- Editing or renaming a trip (spec: no editing).
- Trip details beyond the name: dates, currency, description, notes.
- Trip content beyond the name on the trip page (people, expenses, balances arrive in F3–F5).
- Sharing a trip with another user.
- Trip counts, balances or totals on the list.
- Trip limits, duplicate-name checks, pagination (all trips in one response).
- Cascade delete into people, expenses and payments: checked when F3–F6 add those tables (F2.AC10).
- Integration and end-to-end tests (project rules).

## Decisions log
- 2026-11-19: Stack and layout? → As set in CLAUDE.md. Trip rules in `app/api/src/domain/trip-rules.ts`. Trips code in `app/api/src/trips/`. Reason: CLAUDE.md layout.
- 2026-11-19: Trip IDs? → Prisma `uuid()` strings. A malformed ID matches no row, so it returns `not_found` (spec edge case). Reason: no ID parsing, so no server error.
- 2026-11-19: Ownership check? → Each read and delete filters on `id` and `userId` together. A delete that removes nothing returns `not_found`. Reason: the ownership check sits in the database query (F1.AC11). One statement, so no separate read before the write.
- 2026-11-19: Delete and cascades? → One `DELETE` on the trip. Cascades from F3–F6 run inside that same statement, so R7 holds without a second write. Reason: SQLite runs foreign-key cascades as part of the statement. Foreign keys must be on (F1.T7).
- 2026-11-19: Newest first? → The service sorts with `sortNewestFirst` (created time descending, then ID descending), and Prisma orders the same way. Reason: the rule is tested with fakes. The query sort keeps database work small. The spec does not set a rule for trips created in the same millisecond, so ID order breaks the tie.
- 2026-11-19: Name length? → Characters counted as Unicode code points, as F1.R2 does for passwords. Reason: the spec says characters, not bytes.
- 2026-11-19: Client name rules? → A small mirror in `app/web/src/lib/trip-validation.ts`. The server result wins. Reason: same pattern as F1's client mirror.
- 2026-11-19: Logging? → Nest `Logger` through a port, with user ID and trip ID only. Reason: F2.AC15 and CLAUDE.md logging rules.
- 2026-11-19: Migration? → Needs a person to read and approve before merge. Reason: project rules list database migrations.
- 2026-11-19: Trip page content and route? → Name and "Back to trips" only, from GET `/trips/:id`. Reason: spec open question, approved as name only (2026-11-17).
- 2026-11-19: Plan drafted from the approved spec.
- 2026-11-19: Plan approved by the user. Status set to Approved.
