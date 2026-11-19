# F4 — Expenses

_Status: Approved · Last updated: 2026-11-19 · Spec: [F4-expenses.md](../specs/features/F4-expenses.md)_

## Summary
This plan adds expenses on a trip (build order step 4). It adds the `Expense` and `ExpenseShare` tables, pure rules for the description, the amount and the equal split, a repository whose every query goes through the trip owner, services tested with fake repositories, the expense endpoints behind F1's session guard, and the Expenses section on the trip page. Its last task replaces the placeholder "not in use" check that F3 left in the people removal, so a person in an expense cannot be removed.

Shared work reused, not planned again: the Prisma service and `Trip` ownership pattern (F1.T2, F2.T3), the `SessionGuard` (F1.T9), the web API client and route rules (F1.T11, F2.T7), the trip page and its not-found state (F2.T10), the people repository and the people list (F3.T3, F3.T10, F3.T11). F4.T9 replaces the in-use placeholder that F3.T5 left for this feature. F4.T14 extends the trip page that F3.T11 built.

Notes for review:
- F4.T3 adds a database migration. A person must read and approve it (project rules).
- F4.T9 changes F3's removal path. A person must read and approve it.

## Tasks

### F4.T1 Description and amount rules (pure domain)
- **Files:** `app/api/src/domain/expense-rules.ts` (new), `app/api/src/domain/expense-rules.spec.ts` (new)
- **Does:** `checkDescription` trims leading and trailing spaces and counts characters (code points) of the trimmed text: empty returns `description_required`, more than 100 returns `description_too_long`, otherwise it passes. `parseAmount(text)` returns `{ cents }` or an error code, using only string and integer work. Empty text returns `amount_required`. A leading `-` followed by a valid amount returns `amount_not_positive`. Any text outside `digits`, `digits.digits`, `.digits` and `digits.` returns `amount_invalid`. More than two digits after the point returns `amount_too_many_decimals`. Zero returns `amount_not_positive`. Above 100000000 cents returns `amount_too_large`. No Nest or Prisma imports.
- **Covers:** F4.R2, F4.R3, F4.AC2, F4.AC3
- **Done when:** `npm test -w app/api -- -t "\bF4\.AC(2|3)\b"` passes.

### F4.T2 Equal split and participant order (pure domain)
- **Files:** `app/api/src/domain/split.ts` (new), `app/api/src/domain/split.spec.ts` (new)
- **Does:** `splitEqually(amountCents, count)` returns `count` shares: each is the amount divided by the count, rounded down, and the leftover cents go one each to the first shares in order. `orderByTripOrder(selectedIds, tripPersonIds)` returns the selected IDs in the trip's order, with duplicates removed. The property check uses a fixed-seed pseudo-random generator written in the test file, so runs are repeatable and no new dependency is added.
- **Covers:** F4.R6, F4.AC6
- **Done when:** `npm test -w app/api -- -t "\bF4\.AC6\b"` passes.

### F4.T3 Expenses tables and migration
- **Files:** `app/api/prisma/schema.prisma` (changed: new `Expense` and `ExpenseShare` models; `Trip` gets `expenses Expense[]`; `Person` gets its expense relations), `app/api/prisma/migrations/<timestamp>_add_expenses/migration.sql` (new, generated)
- **Does:** `Expense` maps to `expenses`: `id`, `tripId` (foreign key to `Trip`, `onDelete: Cascade`), `description` (text, stored after trimming), `amountCents` (integer), `payerId` (foreign key to `Person`, `onDelete: NoAction`), `createdAt` (UTC, set on insert). `@@index([tripId])`. `ExpenseShare` maps to `expense_shares`: `expenseId` (foreign key to `Expense`, `onDelete: Cascade`), `personId` (foreign key to `Person`, `onDelete: NoAction`), `shareCents` (integer). Primary key `(expenseId, personId)`. `@@index([personId])`. No date column. Person foreign keys use `NoAction` to match F3's decision (see the Decisions log).
- **Covers:** F4.R1, F4.R4, F4.R6, F4.AC16 (integer columns)
- **Done when:** `npm run db:migrate -w app/api` applies the migration to an empty database and exits 0, and `npm run build -w app/api` exits 0. Code review checks the foreign key actions, the primary key, and the indexes (see the notes under the coverage table).

### F4.T4 Expense repository interface
- **Files:** `app/api/src/expenses/expense.repository.ts` (new, interface)
- **Does:** Interface `ExpenseRepository` with: `findTripPeopleForOwner(userId, tripId)` returns the trip's people `{ id, name }` in trip order (`createdAt`, then `id`), or `null` when the trip is not the owner's. `createForOwner(userId, tripId, expense)` saves an expense and its shares and returns the saved expense, or `not_found`. `listForOwner(userId, tripId)` returns the expenses with payer and shares, or `null`. `deleteForOwner(userId, tripId, expenseId)` returns `removed` or `not_found`. `NewExpense` holds `description`, `amountCents`, `payerId` and `shares: { personId, shareCents }[]`. No Prisma imports.
- **Covers:** F4.R7, F4.R8, F4.R11
- **Done when:** `npm run build -w app/api` exits 0.

### F4.T5 Add service with fake repositories
- **Files:** `app/api/src/expenses/expenses.service.ts` (new; defines `ExpenseError`), `app/api/src/expenses/expenses.service.spec.ts` (new)
- **Does:** `add(userId, tripId, input)` takes `description`, `amount`, `payer_id` and `participant_ids`. It loads the trip's people. A `null` result throws `not_found`, and an empty list throws `no_people`. Then it checks, in this order: description (T1), amount (T1), payer (`payer_required` when empty, `payer_not_on_trip` when not on the trip), participants (`participants_required` when none, `participant_not_on_trip` when any is not on the trip). It orders participants by trip order (T2), splits the amount, and saves through `createForOwner`. A repository `not_found` throws `not_found`. Any other repository error is rethrown, so nothing is saved and the error reaches the error handler. Tests use an in-memory fake `ExpenseRepository` that models trip owners, people and saved expenses. The service depends only on the interface.
- **Covers:** F4.R1, F4.R2, F4.R3, F4.R4, F4.R5, F4.R6, F4.R10, F4.AC1, F4.AC4, F4.AC5, F4.AC7, F4.AC8, F4.AC14
- **Done when:** `npm test -w app/api -- -t "\bF4\.AC(1|4|5|7|8|14)\b"` passes.

### F4.T6 List and delete services with fake repositories
- **Files:** `app/api/src/domain/expense-rules.ts` (changed: `sortExpensesNewestFirst`), `app/api/src/domain/expense-rules.spec.ts` (changed), `app/api/src/expenses/expenses.service.ts` (changed: `list`, `remove`), `app/api/src/expenses/expenses.service.spec.ts` (changed)
- **Does:** `sortExpensesNewestFirst` orders by `createdAt` descending, then `id` descending, the same tie rule as F2's trips. `list(userId, tripId)` throws `not_found` for `null`, and otherwise returns the expenses newest added first, with payer and shares. `remove(userId, tripId, expenseId)` calls `deleteForOwner` once with the trip ID and expense ID, and throws `not_found` when the result is `not_found`. The Cancel path never reaches the service (see F4.T13).
- **Covers:** F4.R7, F4.R8, F4.R11, F4.AC9, F4.AC10, F4.AC11
- **Done when:** `npm test -w app/api -- -t "\bF4\.AC(9|10|11)\b"` passes.

### F4.T7 Expense logging without amounts or tokens
- **Files:** `app/api/src/expenses/expense-logger.ts` (new, port wrapping Nest `Logger`), `app/api/src/expenses/expenses.service.ts` (changed), `app/api/src/expenses/expenses.service.spec.ts` (changed)
- **Does:** The service logs add, list, not-found and delete events with the user ID, trip ID and expense ID only. It never logs an amount, a description, a payer name, a share or the session token. A fake logger in the test records every call, and the test checks that no argument holds the amount, the description or a token.
- **Covers:** F4.AC16
- **Done when:** `npm test -w app/api -- -t "\bF4\.AC16\b"` passes.

### F4.T8 Prisma expense repository
- **Files:** `app/api/src/expenses/prisma-expense.repository.ts` (new)
- **Does:** Implements `ExpenseRepository` with parameterized Prisma calls only. Every query reaches the trip through its owner (`trip: { userId }`) together with the trip ID, as F3.T3 does. `createForOwner` runs one `$transaction`: the owner-scoped trip read, then the insert of the expense and its shares. A foreign-key failure from a person removed in between is not saved and is rethrown, so the user sees the generic failure. `deleteForOwner` is one owner-scoped `deleteMany` on `id`, `tripId` and the owner; the shares go with it through the cascade. A malformed ID matches no row and returns `not_found`, not an error.
- **Covers:** F4.R11, F4.R1
- **Done when:** `npm run build -w app/api` exits 0. Code review checks the owner filter on each query (see the notes under the coverage table).

### F4.T9 Replace F3's in-use placeholder
- **Files:** `app/api/src/people/prisma-person.repository.ts` (changed: the in-use check inside `removeForOwner`)
- **Does:** Replaces the "not in use" placeholder from F3.T5 with a real check. Inside the existing transaction, after the owner-scoped delete, the check asks whether the person is the payer of any expense or has a share in any expense. If so, the result is `in_use` and the transaction rolls back. The foreign-key error mapping from F3.T5 stays.
- **Covers:** F4.R12, F4.AC15
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC(8|9|10|12|14|15)\b"` still passes, and the code review for F4.AC15 is done (see the coverage table).

### F4.T10 Routes behind the session guard
- **Files:** `app/api/src/expenses/expenses.controller.ts` (new), `app/api/src/expenses/expenses.controller.spec.ts` (new), `app/api/src/expenses/expenses.module.ts` (new, provides `ExpenseRepository` with the Prisma adapter and the service, and uses F1's guard), `app/api/src/app.module.ts` (changed, imports `ExpensesModule`)
- **Does:** `@Controller('trips/:id/expenses')` with `SessionGuard` on the class, so every route is guarded. Routes: GET (200), POST (201, reads `description`, `amount`, `payer_id` and `participant_ids` from the body only), DELETE `:expenseId` (204). The owner always comes from the guard's `userId`. A non-string `amount` returns `amount_invalid`. `ExpenseError` maps to `{ "error": code }`: 400 for field codes, 404 for `not_found`, 409 for `no_people`. No PUT or PATCH route exists, so expenses cannot be edited (R13).
- **Covers:** F4.R13, F4.AC8, F4.AC12
- **Done when:** `npm test -w app/api -- -t "\bF4\.AC(8|12)\b"` passes.

### F4.T11 Web rules, money text and API client
- **Files:** `app/web/src/lib/expense-validation.ts` (new, client mirror of the description and amount rules), `app/web/src/lib/expense-validation.spec.ts` (new), `app/web/src/lib/money.ts` (new, `formatCents`), `app/web/src/lib/money.spec.ts` (new), `app/web/src/lib/api-client.ts` (changed: `listExpenses`, `addExpense`, `deleteExpense`), `app/web/src/lib/api-client.spec.ts` (changed), `app/web/src/lib/route-rules.spec.ts` (changed: a case for the expenses path; `route-rules.ts` is unchanged because F1's rule already covers every trip path)
- **Does:** The client mirror gives the approved messages from States & errors for quick feedback. The server result always wins. `formatCents` writes integer cents as text with two decimals (for example 1250 gives "12.50") using integer division and padding, with no floating-point math. The expense client methods use `credentials: 'same-origin'` and return the server's `error` code.
- **Covers:** F4.R2, F4.R3, F4.AC2, F4.AC3, F4.AC13, F4.AC16
- **Done when:** `npm test -w app/web -- -t "\bF4\.AC(2|3|13|16)\b"` passes.

### F4.T12 Add expense form
- **Files:** `app/web/src/components/expense-form.tsx` (new), `app/web/src/components/expense-form.test.tsx` (new)
- **Does:** Visible labels "Description" and "Amount", a "Paid by" select with an empty first option, and a "Shared by" group with one checkbox per person, all checked when the form opens and after a success. The "Add expense" button sends the form. Client messages sit under the field (or the group) and are linked with `aria-describedby`. An invalid submit sends no request. Server codes with no copy of their own (`payer_not_on_trip`, `participant_not_on_trip`) show "Could not add this expense. Try again." Success clears the fields, resets the checkboxes, shows "Expense added." in a polite live region, and calls `onAdded`. A failure keeps the typed values. With no people, the form is replaced by "Add people to this trip before adding an expense." The button is disabled while the request is in flight.
- **Covers:** F4.R5, F4.R10, F4.AC1, F4.AC2, F4.AC3, F4.AC4, F4.AC5, F4.AC8, F4.AC14
- **Done when:** `npm test -w app/web -- -t "\bF4\.AC(1|2|3|4|5|8|14)\b"` passes.

### F4.T13 Expense list and delete panel
- **Files:** `app/web/src/components/expense-list.tsx` (new), `app/web/src/components/expense-list.test.tsx` (new)
- **Does:** "Loading expenses…" while loading, and "No expenses yet. Add the first one above." when empty. Rows appear in the order given, each showing the description, the amount, "Paid by {payer} · shared by {n} people" (or "1 person"), and the line "Shares: {name} {amount}, …" built with `formatCents`. Each row has a Delete button named "Delete {description}". Delete opens a panel on that row with `Delete "{description}"? This cannot be undone.`, "Cancel" first, then "Delete expense". The panel takes focus when it opens, and Escape closes it. Cancel closes it and sends no request. A confirmed delete removes the row and shows "Expense deleted." in a polite live region. A `not_found` response shows "This expense is no longer on this trip." and removes the row. Any other failure shows "Could not delete this expense. Try again." and keeps the row. After a successful delete, focus moves to the Expenses heading, or to the empty-state message if the list is now empty. The component receives the heading's ref from the page (F4.T14).
- **Covers:** F4.R7, F4.R8, F4.R9, F4.AC9, F4.AC10, F4.AC11
- **Done when:** `npm test -w app/web -- -t "\bF4\.AC(9|10|11)\b"` passes.

### F4.T14 Expenses section on the trip page
- **Files:** `app/web/src/app/trips/[id]/page.tsx` (changed: adds the Expenses section below the People section, and holds the people list), `app/web/src/app/trips/[id]/page.test.tsx` (changed)
- **Does:** Loads the people with `listPeople` and the expenses with `listExpenses`. The page now holds the people list, so the expense form and the People section read the same list; F3's add and remove keep updating it. The Expenses section has an "Expenses" heading, the add form (F4.T12) or its no-people message, and the list (F4.T13). An added expense appears at the top of the list without a reload. A `not_found` on the trip shows F2's "This trip could not be found." F1's route rules handle logged-out visitors, so the page adds no redirect.
- **Covers:** F4.R10, F4.AC1, F4.AC8, F4.AC9
- **Done when:** `npm test -w app/web -- -t "\bF4\.AC(1|8|9)\b"` passes.

## AC coverage

Every AC in the spec has one row. One row is "code review" (AC15). AC12 and AC16 are unit-tested and also need a code review check, noted below the table.

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F4.AC1 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-form.test.tsx` | F4.AC1 saves the amount in cents with the payer and participant IDs; F4.AC1 success clears the form and announces "Expense added." | |
| F4.AC2 | `app/api/src/domain/expense-rules.spec.ts` and `app/web/src/lib/expense-validation.spec.ts` | F4.AC2 trims spaces and rejects empty, spaces-only and 101 characters; F4.AC2 client shows "Enter a description." | |
| F4.AC3 | `app/api/src/domain/expense-rules.spec.ts` and `app/web/src/lib/expense-validation.spec.ts` | F4.AC3 accepts 12.50, 12, 12.5 and .5 as cents and rejects each invalid form with its own code; F4.AC3 client shows "Enter an amount like 12.50." | |
| F4.AC4 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-form.test.tsx` | F4.AC4 missing payer returns payer_required and saves nothing; F4.AC4 shows "Choose who paid." and sends no request | |
| F4.AC5 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-form.test.tsx` | F4.AC5 no participants returns participants_required and saves nothing; F4.AC5 every person is checked on open and no one checked shows "Choose at least one person to share this expense." | |
| F4.AC6 | `app/api/src/domain/split.spec.ts` | F4.AC6 10.00 among three gives 3.34, 3.33, 3.33; F4.AC6 0.01 among three gives 0.01, 0.00, 0.00; F4.AC6 shares always add up to the amount; F4.AC6 leftover cents follow trip order | |
| F4.AC7 | `app/api/src/expenses/expenses.service.spec.ts` | F4.AC7 payer who is not a participant is accepted and has no share | |
| F4.AC8 | `app/api/src/expenses/expenses.service.spec.ts`, `app/api/src/expenses/expenses.controller.spec.ts`, `app/web/src/components/expense-form.test.tsx` and `app/web/src/app/trips/[id]/page.test.tsx` | F4.AC8 no people returns no_people and saves nothing; F4.AC8 POST returns 409 no_people; F4.AC8 form is replaced by the no-people message; F4.AC8 page shows the no-people message | |
| F4.AC9 | `app/api/src/domain/expense-rules.spec.ts`, `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-list.test.tsx` | F4.AC9 sorts newest added first; F4.AC9 list returns payer and shares newest first; F4.AC9 rows show description, amount, payer and share line; F4.AC9 no expenses shows "No expenses yet. Add the first one above." | |
| F4.AC10 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-list.test.tsx` | F4.AC10 confirmed delete calls the repository once with trip ID and expense ID; F4.AC10 Cancel sends no request and keeps the row; F4.AC10 confirmed delete removes the row and shows "Expense deleted." | |
| F4.AC11 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-list.test.tsx` | F4.AC11 expense not on this trip returns not_found and deletes nothing; F4.AC11 already-deleted expense shows "This expense is no longer on this trip." and removes the row | |
| F4.AC12 | `app/api/src/expenses/expenses.controller.spec.ts` | F4.AC12 every expense route is behind the session guard; F4.AC12 no session returns 401 and the handler is not called | Also code review: the owner filter on every real query (see the notes). |
| F4.AC13 | `app/web/src/lib/route-rules.spec.ts` | F4.AC13 logged-out visitor on `/trips/:id/expenses` is sent to Log in | |
| F4.AC14 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/components/expense-form.test.tsx` | F4.AC14 repository failure is rethrown and saves nothing; F4.AC14 failed add shows "Could not add this expense. Try again." and keeps the typed values | |
| F4.AC15 | code review | code review | Removal of a person becomes allowed once their last expense is deleted. This depends on the real `expenses` and `expense_shares` rows that F4.T9's query reads. The fake repository cannot prove the query. |
| F4.AC16 | `app/api/src/expenses/expenses.service.spec.ts` and `app/web/src/lib/money.spec.ts` | F4.AC16 stored amounts are whole cents; F4.AC16 add, list and delete log no amounts, descriptions or tokens; F4.AC16 formats cents as text with no floating-point math | Also code review: the integer columns in the real schema (F4.T3). |

Code review also needed for the unit-tested rows:
- **F4.AC12:** the Prisma queries in `prisma-expense.repository.ts` (F4.T8) filter on the owner in every read, add and delete. A real request with no session gets 401 from the running server.
- **F4.AC16:** the `amountCents` and `shareCents` columns are integers in the migration (F4.T3).
- **F4.AC15:** a person with an expense cannot be removed, and the same person can be removed after their last expense is deleted. Check on a real database after F4.T9 and F4.T8 land.
- **Foreign keys:** `expenses.payerId` and `expense_shares.personId` use `NoAction` (F4.T3), and the trip keys use `Cascade`.
- **Keys and indexes:** the primary key `(expenseId, personId)` and the indexes on `expenses.tripId` and `expense_shares.personId` exist (F4.T3).
- **Trip delete:** deleting a trip removes its expenses and shares in the same statement (F2.AC10). Check again after F6 adds payments.

## Out of scope
- Editing an expense in any field (spec: No editing). A mistake is fixed by deleting and adding again.
- Uneven splits, percentage splits, or any split other than equal.
- Expense dates, currency and conversion, attachments, categories, notes and receipts.
- Balances and settle-up figures (F5 and F6).
- Choosing a person who is not on the trip, and adding a person from inside the expense form (F3).
- Integration and end-to-end tests (project rules).

## Decisions log
- 2026-11-19: Person foreign keys → `onDelete: NoAction`, as F3's decision requires, not `Restrict`. The spec's "restrict on delete" is met: a person with an expense cannot be deleted, and the delete fails and maps to `in_use`. Reason: SQLite checks RESTRICT immediately, which breaks the trip and account cascades (F2, F1).
- 2026-11-19: Amount with a leading minus (for example "-1") → `amount_not_positive`, so the user sees "The amount must be more than zero." Reason: spec AC3 requires negative amounts to show that message. Any other text with a sign is `amount_invalid`.
- 2026-11-19: Amount check order → format, then more than two decimals, then zero, then the maximum. "12.345" and "0.000" are reported as too many decimals. Reason: each input gets one code, and the spec's test plan names the code for "12.345".
- 2026-11-19: Length counts → characters as Unicode code points, as F1, F2 and F3 do. Reason: the spec says characters.
- 2026-11-19: Validation order in add → trip owner, then `no_people`, then description, amount, payer and participants. Reason: `no_people` is the trip-level state, and field errors come after it.
- 2026-11-19: Add is one `$transaction` that reads the owner's trip and inserts the expense with its shares. Reason: CLAUDE.md requires one transaction for writes to more than one record. A person removed between the people read and the insert fails the foreign key and is reported as the generic failure, so nothing partial is saved.
- 2026-11-19: Delete is one owner-scoped `deleteMany`. Shares go with it through the `Cascade` key. Reason: one statement, no separate read, the same pattern as F2.T3.
- 2026-11-19: Newest-first sort → `createdAt` descending, then `id` descending, the same tie rule as F2's trips. Reason: the spec's tie rule and the Decisions log's "newest first".
- 2026-11-19: Shares are stored (`expense_shares`), not recalculated. Reason: the spec, so F5 reads what the user saw.
- 2026-11-19: Expenses section sits below the People section on `/trips/:id`, and the page holds the people list shared by both. Reason: F3 put People below the trip name, and the expense form needs the same people list. The spec does not set the order.
- 2026-11-19: "Paid by" select has an empty first option with no text, so nothing is pre-filled. Reason: the spec says the field is left empty, and the spec sets no placeholder copy.
- 2026-11-19: Cancel is tested in the web component, not in the service. Reason: Cancel never reaches the API, the same decision as F3.AC7.
- 2026-11-19: Money text → `formatCents` builds "12.50" from integer cents. Reason: AC16 bans floating-point amounts, and the display follows the same rule.
- 2026-11-19: Plan drafted from the approved spec. No product question came up in planning.
- 2026-11-19: Plan approved by the user. Status set to Approved.
