# F3 — People

_Status: Approved · Last updated: 2026-11-19 · Spec: [F3-people.md](../specs/features/F3-people.md)_

## Summary
This plan adds people to a trip (build order step 3). It adds the `Person` table, pure name rules, a repository whose every query goes through the trip owner, a service tested with fake repositories, the people endpoints behind F1's session guard, and the People section on the trip page. Removal runs its write first inside one transaction, then checks whether the person is in use. The in-use check returns "not in use" until F4 and F6 add the expense and payment tables; their plans must replace it.

Shared work reused, not planned again: the Prisma service and `Trip` ownership pattern (F1.T2, F2.T3), the `SessionGuard` (F1.T9), the web API client (F2.T7), and the trip page and its not-found state (F2.T10). F3.T11 extends the trip page.

Notes for review:
- F3.T2 adds a database migration. A person must read and approve it (project rules).

## Tasks

### F3.T1 Person name rules (pure domain)
- **Files:** `app/api/src/domain/person-rules.ts` (new), `app/api/src/domain/person-rules.spec.ts` (new)
- **Does:** `normalizePersonName` trims leading and trailing spaces. `checkPersonName` counts characters (code points) of the trimmed name: empty returns `name_required`, more than 100 returns `name_too_long`, otherwise it passes. `personNameKey` returns the trimmed name in lower case, used for the duplicate check and the unique column. No Nest or Prisma imports.
- **Covers:** F3.R2, F3.R3, F3.R4, F3.AC2, F3.AC3, F3.AC4
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC(2|3|4)\b"` passes.

### F3.T2 People table and migration
- **Files:** `app/api/prisma/schema.prisma` (changed: new `Person` model; `Trip` gets `people Person[]`), `app/api/prisma/migrations/<timestamp>_add_people/migration.sql` (new, generated)
- **Does:** `Person`: `id` (uuid string, primary key), `tripId` (foreign key to `Trip`, `onDelete: Cascade`), `name` (text, stored as typed after trimming), `nameKey` (text, the value from `personNameKey`), `createdAt` (UTC, set on insert). Unique `(tripId, nameKey)`. `@@index([tripId])`. Expense and payment tables come later; their foreign keys to people use `onDelete: NoAction` and are added by F4 and F6.
- **Covers:** F3.R1, F3.R4, F3.R5
- **Done when:** `npm run db:migrate -w app/api` applies the migration to an empty database and exits 0, and `npm run build -w app/api` exits 0. Code review checks the unique index and the trip cascade (see the notes under the coverage table).

### F3.T3 Person repository interface and Prisma adapter
- **Files:** `app/api/src/people/person.repository.ts` (new, interface), `app/api/src/people/prisma-person.repository.ts` (new)
- **Does:** Interface `PersonRepository` with `listForOwner(userId, tripId)` (ordered by `createdAt` ascending, then `id`), `createForOwner(userId, tripId, name, nameKey)` and `removeForOwner(userId, tripId, personId)`. `removeForOwner` returns `removed`, `not_found` or `in_use`. A duplicate `(tripId, nameKey)` from the database is raised as `name_taken`. The Prisma version uses parameterized calls only. Every query reaches the trip through its relation and filters on `userId` together with the trip ID. A trip that is not the owner's returns `not_found`. A malformed ID matches no row and returns `not_found`, not an error.
- **Covers:** F3.R7, F3.R14
- **Done when:** `npm run build -w app/api` exits 0. Code review checks that each query filters on the owner (see the notes under the coverage table).

### F3.T4 Add and list service with fake repositories
- **Files:** `app/api/src/people/people.service.ts` (new; defines `PersonError`), `app/api/src/people/people.service.spec.ts` (new)
- **Does:** `list(userId, tripId)` returns `id` and `name` only, oldest added first, and throws `not_found` when the repository finds no owned trip. `add(userId, tripId, rawName)` normalizes the name, runs `checkPersonName` (throws `name_required` or `name_too_long`), and checks the key against the trip's people (throws `name_taken`). It saves the person at the end of the list and returns `{ id, name }`. A `name_taken` from the repository (the database race) is mapped to the same error. Tests use an in-memory fake `PersonRepository` that models trip owners and per-trip name keys. The service depends only on the interface.
- **Covers:** F3.R1, F3.R2, F3.R3, F3.R4, F3.R5, F3.R6, F3.R7, F3.R8, F3.R14, F3.AC1, F3.AC5, F3.AC6, F3.AC11, F3.AC14
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC(1|5|6|11|14)\b"` passes.

### F3.T5 Remove service and the in-use transaction
- **Files:** `app/api/src/people/people.service.ts` (changed: `remove`), `app/api/src/people/people.service.spec.ts` (changed), `app/api/src/people/person.repository.ts` (changed: `removeForOwner`), `app/api/src/people/prisma-person.repository.ts` (changed: `removeForOwner`)
- **Does:** `remove(userId, tripId, personId)` maps the repository result: `removed` returns normally, `not_found` throws `not_found`, `in_use` throws `person_in_use`. In the Prisma adapter, one `$transaction` runs the owner-scoped delete first, so SQLite's write lock is taken before anything is read. It then runs the in-use check. If the person is in use, the transaction rolls back and the row stays. A foreign-key error on the delete (the `NoAction` foreign keys from F4 and F6 are checked at the end of the statement) is also mapped to `in_use`. The in-use check returns "not in use" until F4 (expenses) and F6 (payments) add their tables and replace it.
- **Covers:** F3.R9, F3.R10, F3.R11, F3.R12, F3.R14, F3.AC8, F3.AC9, F3.AC10, F3.AC12, F3.AC14, F3.AC15, F3.AC17
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC(8|9|10|12|14|15)\b"` passes. AC17 is checked in code review.

### F3.T6 People logging without names or tokens
- **Files:** `app/api/src/people/people-logger.ts` (new, port wrapping Nest `Logger`), `app/api/src/people/people.service.ts` (changed), `app/api/src/people/people.service.spec.ts` (changed)
- **Does:** The service logs list, add, name-taken, not-found, remove and in-use events with the user ID, trip ID and person ID only. It never logs a person name or the session token. A fake logger in the test records every call.
- **Covers:** F3.AC18
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC18\b"` passes.

### F3.T7 Routes behind the session guard
- **Files:** `app/api/src/people/people.controller.ts` (new), `app/api/src/people/people.controller.spec.ts` (new), `app/api/src/people/people.module.ts` (new, provides `PersonRepository` with the Prisma adapter and the service, and uses F1's guard), `app/api/src/app.module.ts` (changed, imports `PeopleModule`)
- **Does:** `@Controller('trips/:id/people')` with `SessionGuard` on the class, so every route is guarded. Routes: GET (200), POST (201, reads `name` from the body only), DELETE `:personId` (204). The owner always comes from the guard's `userId`. `PersonError` maps to `{ "error": code }`: 400 for name errors, 404 for `not_found`, 409 for `name_taken` and `person_in_use`. No PUT or PATCH route exists, so names cannot change (R13).
- **Covers:** F3.R13, F3.R14, F3.AC13, F3.AC16
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC(13|16)\b"` passes.

### F3.T8 Web name rules and people API client
- **Files:** `app/web/src/lib/person-validation.ts` (new, client mirror of the name rules), `app/web/src/lib/person-validation.spec.ts` (new), `app/web/src/lib/api-client.ts` (changed: `listPeople`, `addPerson`, `removePerson`), `app/web/src/lib/api-client.spec.ts` (changed)
- **Does:** The client mirror gives the approved messages ("Enter a name.", "Names can be up to 100 characters.") for quick feedback. The server result always wins. The people client methods use `credentials: 'same-origin'` and return the server's `error` code.
- **Covers:** F3.R2, F3.R3, F3.AC3, F3.AC4
- **Done when:** `npm test -w app/web -- -t "\bF3\.AC(3|4)\b"` passes.

### F3.T9 Add person form
- **Files:** `app/web/src/components/add-person-form.tsx` (new), `app/web/src/components/add-person-form.test.tsx` (new)
- **Does:** Visible label "Person name" and an "Add person" button. Empty and too-long messages show under the field, linked to it with `aria-describedby`. An invalid submit sends no request. Success clears the field, shows "Person added." in a polite live region, and calls `onAdded` with the new person. A `name_taken` response shows "Someone on this trip already has that name." under the field and keeps the typed name. Any other failure shows "Could not add this person. Try again." and keeps the typed name. The button is disabled while the request is in flight.
- **Covers:** F3.R3, F3.R4, F3.AC1, F3.AC3, F3.AC4, F3.AC5
- **Done when:** `npm test -w app/web -- -t "\bF3\.AC(1|3|4|5)\b"` passes.

### F3.T10 People list, remove confirmation and blocked message
- **Files:** `app/web/src/components/people-list.tsx` (new), `app/web/src/components/people-list.test.tsx` (new)
- **Does:** Rows appear in the order given, each showing the name only and a Remove button named "Remove <name>". "Loading people…" while loading. With no people, "No people yet. Add the people on this trip." Remove opens a panel on that row: "Remove {name} from this trip?" with "Cancel" first, then "Remove person". The panel takes focus when it opens, and Escape closes it. Cancel closes it and sends no request. A confirmed removal removes the row and shows "Person removed.". A `person_in_use` response shows "This person is in an expense or payment, so they can't be removed." on that row, and the row stays. Any other failure shows "Could not remove this person. Try again." and the row stays. A `not_found` response shows "This person is no longer on this trip." and removes the row. After a successful removal, focus moves to the People heading, or to the empty-state message if the list is now empty. Status messages use a polite live region.
- **Covers:** F3.R8, F3.R9, F3.R10, F3.AC7, F3.AC8, F3.AC9, F3.AC10, F3.AC11
- **Done when:** `npm test -w app/web -- -t "\bF3\.AC(7|8|9|10|11)\b"` passes.

### F3.T11 People section on the trip page
- **Files:** `app/web/src/app/trips/[id]/page.tsx` (changed: adds the People section below the trip name), `app/web/src/app/trips/[id]/page.test.tsx` (changed)
- **Does:** Keeps F2's trip name, "Back to trips" link and not-found message. Adds a People heading, the add form (F3.T9) and the people list (F3.T10), loaded with `listPeople`. A person added through the form appears at the bottom of the list without a page reload. The page adds no redirect; F1's route rules handle logged-out visitors.
- **Covers:** F3.R7, F3.R8, F3.AC1, F3.AC11
- **Done when:** `npm test -w app/web -- -t "\bF3\.AC(1|11)\b"` passes.

## AC coverage

Every AC in the spec has one row. One row is "code review" (AC17). The other rows have a unit test, and some also need a code review check, noted below the table.

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F3.AC1 | `app/api/src/people/people.service.spec.ts` and `app/web/src/components/add-person-form.test.tsx` | F3.AC1 saves "Sam" at the bottom of the trip's people; F3.AC1 a saved person clears the field and is reported to the list | |
| F3.AC2 | `app/api/src/domain/person-rules.spec.ts` | F3.AC2 trims leading and trailing spaces before save | |
| F3.AC3 | `app/api/src/domain/person-rules.spec.ts`, `app/web/src/lib/person-validation.spec.ts` and `app/web/src/components/add-person-form.test.tsx` | F3.AC3 rejects empty and spaces-only names; F3.AC3 client shows "Enter a name."; F3.AC3 empty name shows "Enter a name." and sends no request | |
| F3.AC4 | `app/api/src/domain/person-rules.spec.ts`, `app/web/src/lib/person-validation.spec.ts` and `app/web/src/components/add-person-form.test.tsx` | F3.AC4 rejects 101 characters and accepts 100; F3.AC4 client shows the limit message; F3.AC4 101 characters shows the limit message and sends no request | |
| F3.AC5 | `app/api/src/people/people.service.spec.ts` and `app/web/src/components/add-person-form.test.tsx` | F3.AC5 "sam" and " SAM " are rejected and "Sam" stays; F3.AC5 duplicate shows the message and keeps the typed name | |
| F3.AC6 | `app/api/src/people/people.service.spec.ts` | F3.AC6 the same name on another trip is saved for that trip only | |
| F3.AC7 | `app/web/src/components/people-list.test.tsx` | F3.AC7 Cancel closes the panel, sends no delete request and keeps the row | |
| F3.AC8 | `app/api/src/people/people.service.spec.ts` and `app/web/src/components/people-list.test.tsx` | F3.AC8 confirmed removal calls the repository once with trip ID and person ID; F3.AC8 confirmed removal removes the row and shows "Person removed." | |
| F3.AC9 | `app/api/src/people/people.service.spec.ts` and `app/web/src/components/people-list.test.tsx` | F3.AC9 a person in use is not removed and returns person_in_use; F3.AC9 blocked message shows on that row and the row stays | Also code review with real expense rows, once F4 exists (see the notes). |
| F3.AC10 | `app/api/src/people/people.service.spec.ts` | F3.AC10 a payer or payee of a payment is not removed | Also code review with real payment rows, once F6 exists (see the notes). |
| F3.AC11 | `app/api/src/people/people.service.spec.ts` and `app/web/src/components/people-list.test.tsx` | F3.AC11 list returns oldest first with name only; F3.AC11 rows show names oldest first with no other detail | |
| F3.AC12 | `app/api/src/people/people.service.spec.ts` | F3.AC12 a name freed by removal is accepted again | |
| F3.AC13 | `app/api/src/people/people.controller.spec.ts` | F3.AC13 no PUT or PATCH route exists for people | |
| F3.AC14 | `app/api/src/people/people.service.spec.ts` | F3.AC14 user B's list, add and remove return not_found and change nothing | Also code review of the owner filter in the real queries (see the notes). |
| F3.AC15 | `app/api/src/people/people.service.spec.ts` | F3.AC15 a person ID from another trip returns not_found and the person is unchanged | |
| F3.AC16 | `app/api/src/people/people.controller.spec.ts` | F3.AC16 every people route is behind the session guard | Also code review: a real request with no session gets 401 (see the notes). |
| F3.AC17 | code review | code review | Database constraints and transaction: the foreign keys from expenses and payments to people use `NoAction` (F4, F6), and the in-use check and the removal share one transaction (F3.T5). A unit test cannot prove either. |
| F3.AC18 | `app/api/src/people/people.service.spec.ts` | F3.AC18 add, list and remove log no person name and no session token | |

Code review also needed for the unit-tested rows:
- **F3.AC9 and F3.AC10:** real expense and payment rows block removal. The fake repository covers only the logic. Check after F4 and F6 land.
- **F3.AC14 and F3.AC15:** the owner filter in `prisma-person.repository.ts` (F3.T3, F3.T5) is on every query.
- **F3.AC16:** a real request with no session gets 401 from the running server.
- **Unique index** `people (tripId, nameKey)` and the **index on `people.tripId`** exist (F3.T2).
- **Trip delete cascade:** deleting a trip deletes its people through the `Cascade` foreign key in one `DELETE` (F2.AC10). Check again after F4 and F6 add their tables.
- **NoAction foreign keys:** F4 and F6 declare their foreign keys from expenses and payments to people as `onDelete: NoAction`, and their trip foreign keys as `onDelete: Cascade`. Check in their plans' code reviews.

## Out of scope
- Renaming a person. Names are never edited (spec: No editing). A mistake is fixed by removing and adding again.
- Accounts, invitations or logins for people.
- Choosing participants in an expense (F4).
- Removing a person who is in an expense or payment. This is blocked, and the user deletes those first (F4, F6).
- The expense and payment tables and their real in-use checks (F4 and F6 plans).
- Uneven splits, editing, or importing people.
- Integration and end-to-end tests (project rules).

## Decisions log
- 2026-11-19: Plan drafted from the approved spec. Reused shared work listed in the Summary; no F1 or F2 task is planned again.
- 2026-11-19: Duplicate check → a stored `nameKey` column (trimmed, lower case) with a unique `(tripId, nameKey)` index, instead of `lower(name)`. Reason: SQLite's `lower()` only folds ASCII letters, so an expression index would allow "É" and "é" on one trip while the app rejects them. The stored key makes the database rule match the app rule exactly. The spec's rule is unchanged.
- 2026-11-19: Trip delete → stays one `DELETE` on the trip, with cascades, as F2's plan says. Foreign keys from expenses and payments to people use `onDelete: NoAction`, not restrict. Reason: SQLite checks RESTRICT immediately, even in the middle of a cascade, so a trip delete (F2) or an account delete (F1, one `DELETE` on `User` cascading through trips) would fail. SQLite checks NO ACTION at the end of the statement, so a full trip or account cascade succeeds, while deleting one person who is still referenced fails and is mapped to `in_use`. F4 must declare its person foreign keys as `onDelete: NoAction` and its trip foreign keys as `onDelete: Cascade`. F6 must do the same.
- 2026-11-19: In-use check → runs in the same transaction as the removal, after the owner-scoped delete. Reason: CLAUDE.md's SQLite rule; the write takes the lock before the check. Until F4 and F6 add their tables, the check returns "not in use"; those plans must replace it. This means F3.AC9 and F3.AC10 are unit-tested with a fake until then.
- 2026-11-19: Malformed person IDs → `not_found`. Reason: same as F2's trip IDs; no ID parsing, no server error.
- 2026-11-19: AC7 (Cancel) is tested in the web component, not in the repository. The spec's test plan wording mentions the repository. Reason: Cancel never reaches the API, so the component test is the place to prove it sends no request.
- 2026-11-19: Duplicate race → a database unique violation maps to `name_taken` (409). Reason: the spec's edge case for two tabs adding the same name.
- 2026-11-19: Migration F3.T2 → needs a person to read and approve before merge. Reason: project rules list database migrations.
- 2026-11-19: Plan approved by the user. Status set to Approved.
