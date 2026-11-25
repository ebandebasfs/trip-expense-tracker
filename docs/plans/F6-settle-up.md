# F6 — Settle up

_Status: Approved · Last updated: 2026-11-19 · Spec: [F6-settle-up.md](../specs/features/F6-settle-up.md)_

## Summary
This plan adds Settle up (build order step 6, the last MVP feature). It adds the `payments` table, a pure rule for suggested payments (R6), the payment term in the balance calculation, and a payment repository whose record step checks the suggestion and inserts the payment in one transaction. It adds services tested with fake repositories, the payment endpoints behind F1's session guard, and the Settle up section with its Payments made list below Balances on the trip page. Its removal change makes a person who is in a payment unremovable, by extending F3's and F4's in-use check.

Shared work reused, not planned again: `computeBalances` and its tests (F5.T1, extended in T1 here), the balance read and balances service (F5.T3, F5.T4, extended in T4 here), the balances `balanceVersion` refresh counter on the trip page (F5.T7), `formatCents` (F4.T11), the newest-first tie rule (F4.T6), the owner-scoped query pattern (F2.T3, F3.T3), the in-use check (F3.T5, F4.T9, extended in T7), the `SessionGuard` (F1.T9), the web API client and route rules (F1.T11, F2.T7, F4.T11), the trip page sections (F4.T14). The delete confirmation panel follows F4.T13's pattern, but T12 builds its own component for payments.

Notes for review:
- F6.T3 adds a database migration. A person must read and approve it (project rules).
- F6.T7 changes F3's and F4's removal path. A person must read and approve it.

## Tasks

### F6.T1 Payment term in balances (pure domain)
- **Files:** `app/api/src/domain/balance-rules.ts` (changed: `computeBalances` takes a third argument, `payments`), `app/api/src/domain/balance-rules.spec.ts` (changed: F5's calls pass `[]`; new payment tests)
- **Does:** A payment `{ payerId, payeeId, amountCents }` adds its amount to the payer's balance and subtracts it from the payee's (R4). Balances still add up to exactly zero (R5). Integer cents only. No Nest or Prisma imports.
- **Covers:** F6.R13, F6.AC8
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC8\b"` passes, and `npm test -w app/api -- -t "\bF5\.AC(1|2|3|5|10)\b"` still passes.

### F6.T2 Suggested payments (pure domain)
- **Files:** `app/api/src/domain/settle-rules.ts` (new), `app/api/src/domain/settle-rules.spec.ts` (new)
- **Does:** `suggestPayments(balances)` takes `{ personId, balanceCents }[]` in trip order and returns `{ payerId, payeeId, amountCents }[]` in the order calculated. While any balance is negative, the largest debtor pays the largest creditor the smaller of their two amounts. Both are reduced by that amount. Ties go to the person earlier in trip order (F6.R2). Zero balances are skipped, and every amount is above zero. The property check uses a fixed-seed generator written in the test file, as F5.T1 does. No Nest or Prisma imports.
- **Covers:** F6.R1, F6.R2, F6.R3, F6.AC1, F6.AC2, F6.AC3, F6.AC4, F6.AC11
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC(1|2|3|4|11)\b"` passes.

### F6.T3 Payments table and migration
- **Files:** `app/api/prisma/schema.prisma` (changed: new `Payment` model; `Trip` gets `payments Payment[]`; `Person` gets its payment relations), `app/api/prisma/migrations/<timestamp>_add_payments/migration.sql` (new, generated)
- **Does:** `Payment` maps to `payments`: `id`, `tripId` (foreign key to `Trip`, `onDelete: Cascade`), `payerId` and `payeeId` (foreign keys to `Person`, `onDelete: NoAction`, as F3 and F4 decided), `amountCents` (integer), `createdAt` (UTC, set on insert). Indexes on `tripId`, `payerId` and `payeeId`. No update or date columns beyond `createdAt`. Whether payer and payee are on the trip is not a database constraint; F6.T6 checks it in the transaction.
- **Covers:** F6.R5, F6.R16, F6.AC17 (code review)
- **Done when:** `npm run db:migrate -w app/api` applies the migration to an empty database and exits 0, and `npm run build -w app/api` exits 0. Code review checks the foreign key actions, the integer column and the indexes (see the notes under the coverage table).

### F6.T4 Balance read includes payments
- **Files:** `app/api/src/balances/ledger-read.ts` (new: `readLedgerForOwner(tx, userId, tripId)`), `app/api/src/balances/balance.repository.ts` (changed: the result adds `payments`), `app/api/src/balances/prisma-balance.repository.ts` (changed: uses `readLedgerForOwner` inside its `$transaction`), `app/api/src/balances/balances.service.ts` (changed: passes payments to `computeBalances`), `app/api/src/balances/balances.service.spec.ts` (changed)
- **Does:** `readLedgerForOwner` returns the trip's people in trip order, its expenses with shares, and its payments `{ id, payerId, payeeId, amountCents, createdAt }` newest added first (`createdAt` descending, then `id` descending, as F4.T6). It returns `null` when the trip is not the owner's. The balance read and the payment repository (F6.T6) both use it, so there is one snapshot query and one owner filter. The balances service passes payments into `computeBalances`, so the Balances section (F5) shows payments from now on. Its response shape does not change. The fake repository in the test models payments.
- **Covers:** F6.R13, F6.R14, F6.AC8
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC8\b"` passes, and `npm test -w app/api -- -t "\bF5\.AC(3|5|6|9)\b"` still passes. Code review checks the owner filter in `ledger-read.ts` (see the notes under the coverage table).

### F6.T5 Payment input rules (pure domain)
- **Files:** `app/api/src/domain/payment-rules.ts` (new), `app/api/src/domain/payment-rules.spec.ts` (new)
- **Does:** `checkPaymentInput({ payerId, payeeId, amountCents })` returns `invalid_payment` when a required ID is missing or empty, when the payer equals the payee, or when the amount is not a positive safe integer. Otherwise it returns the input unchanged. No Nest or Prisma imports.
- **Covers:** F6.R5, F6.R16, F6.AC6
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC6\b"` passes.

### F6.T6 Payment repository and Prisma adapter
- **Files:** `app/api/src/payments/payment.repository.ts` (new, interface), `app/api/src/payments/prisma-payment.repository.ts` (new)
- **Does:** Interface `PaymentRepository` with two methods. `recordForOwner(userId, tripId, draft, decide)` runs `decide(ledger)` and inserts the payment only if `decide` returns `ok`. It returns `recorded` with the saved payment, `stale_suggestion`, `invalid_payment` or `not_found`. `deleteForOwner(userId, tripId, paymentId)` returns `removed`, `trip_not_found` or `payment_not_found`. The Prisma version of `recordForOwner` runs one `$transaction`. Its first statement is a parameterized no-op `UPDATE` of the owner's trip row (`SET id = id WHERE id = ? AND userId = ?`), with no count 0 meaning `not_found`. That takes SQLite's write lock before the ledger is read (CLAUDE.md). Then it calls `readLedgerForOwner` (T4), then `decide`, then the insert. `deleteForOwner` runs one `$transaction` with two statements: the owner-scoped read of the trip, then one `deleteMany` on `id` and `tripId`. A count of 0 returns `payment_not_found`. Parameterized calls only. A malformed ID matches no row.
- **Covers:** F6.R7, F6.R10, F6.R14, F6.R17
- **Done when:** `npm run build -w app/api` exits 0. Code review checks the owner filter on each query and the write-first order in the transaction (see the notes under the coverage table).

### F6.T7 Payments count as in use for people
- **Files:** `app/api/src/people/prisma-person.repository.ts` (changed: the in-use check inside `removeForOwner` also asks whether the person is payer or payee of any payment)
- **Does:** Adds the payments part to the in-use check that F4.T9 wrote. The check runs in the same transaction, after the owner-scoped delete, as before. A person in a payment is not removed. The foreign-key error mapping from F3.T5 stays.
- **Covers:** F6.R15, F6.AC16 (code review)
- **Done when:** `npm test -w app/api -- -t "\bF3\.AC(8|9|10|12|14|15)\b"` still passes. Code review for F6.AC16 is done (see the coverage table).

### F6.T8 Settle-up read service
- **Files:** `app/api/src/payments/payments.service.ts` (new; defines `PaymentError`), `app/api/src/payments/payments.service.spec.ts` (new)
- **Does:** `settleUp(userId, tripId)` reads the ledger through the balance repository interface (F5.T3, extended in T4). A `null` result throws `PaymentError('not_found')`. Otherwise it computes balances (T1) and suggestions (T2), and returns `suggestions` as `{ payer: { id, name }, payee: { id, name }, amountCents }` and `payments` as `{ id, payer, payee, amountCents }`, newest first. Every payment names two people from the same trip, so the names always resolve. With no people both lists are empty. Zero balances give no suggestions. Suggestions are calculated on each call and never stored (F6.R4). Tests use an in-memory fake that models owners, people, expenses and payments in one store. The service depends only on the interfaces.
- **Covers:** F6.R1, F6.R4, F6.R9, F6.R18, F6.R19, F6.AC11, F6.AC12
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC(11|12)\b"` passes.

### F6.T9 Record and delete services with logging
- **Files:** `app/api/src/payments/payments.service.ts` (changed: `record`, `remove`), `app/api/src/payments/payments.service.spec.ts` (changed), `app/api/src/payments/payment-logger.ts` (new, port wrapping Nest `Logger`)
- **Does:** `record(userId, tripId, input)` runs `checkPaymentInput` (T5), which throws `invalid_payment`. It then calls `recordForOwner` with a `decide` function. `decide` returns `invalid` unless the payer and payee are people on the trip, and `stale` unless the draft matches one current suggestion exactly (payer, payee and amount). Otherwise it returns `ok`. Results map to `not_found`, `stale_suggestion` and `invalid_payment`. A repository failure is rethrown, so nothing is saved and the error reaches the error handler. `remove(userId, tripId, paymentId)` calls `deleteForOwner` once and maps `trip_not_found` to `not_found` and `payment_not_found` to `payment_not_found`. The logger records record, stale, delete and not-found events with user ID, trip ID and payment ID only. It never logs an amount, a name or a token. A fake logger records every call in the test.
- **Covers:** F6.R5, F6.R6, F6.R8, F6.R10, F6.R14, F6.AC5, F6.AC6, F6.AC7, F6.AC8, F6.AC9, F6.AC10, F6.AC13, F6.AC15
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC(5|6|7|8|9|10|13|15)\b"` passes.

### F6.T10 Payment routes behind the session guard
- **Files:** `app/api/src/payments/settle-up.controller.ts` (new), `app/api/src/payments/settle-up.controller.spec.ts` (new), `app/api/src/payments/payments.module.ts` (new, provides `PaymentRepository` with the Prisma adapter and the service, imports the balance repository from `BalancesModule`, and uses F1's guard), `app/api/src/balances/balances.module.ts` (changed: exports the balance repository), `app/api/src/app.module.ts` (changed, imports `PaymentsModule`)
- **Does:** `@Controller('trips/:id')` with `SessionGuard` on the class, so every route is guarded. Routes: GET `settle-up` (200, the shape in the spec's API table), POST `payments` (201, reads `payer_id`, `payee_id` and `amount_cents` from the body only), DELETE `payments/:paymentId` (204). The owner always comes from the guard's `userId`. Errors map to `{ "error": code }`: `not_found` and `payment_not_found` to 404, `invalid_payment` to 400, `stale_suggestion` to 409. Other errors reach the error handler. No PUT or PATCH route exists, so payments are never edited (F6.R12).
- **Covers:** F6.R12, F6.R14, F6.AC10, F6.AC13
- **Done when:** `npm test -w app/api -- -t "\bF6\.AC(10|13)\b"` passes.

### F6.T11 Web payment client and wording
- **Files:** `app/web/src/lib/api-client.ts` (changed: `getSettleUp`, `recordPayment`, `deletePayment`), `app/web/src/lib/api-client.spec.ts` (changed), `app/web/src/lib/payment-text.ts` (new: "{payer} pays {payee} {amount}" and "{payer} paid {payee} {amount}", using `formatCents` from F4.T11), `app/web/src/lib/payment-text.spec.ts` (new)
- **Does:** The client methods use `credentials: 'same-origin'` (F1.T11) and return the server's `error` code, such as `stale_suggestion` or `payment_not_found`. The wording helpers give two decimal places and do no floating-point math.
- **Covers:** F6.R9, F6.AC5, F6.AC6, F6.AC10
- **Done when:** `npm test -w app/web -- -t "\bF6\.AC(5|6|10)\b"` passes.

### F6.T12 Payments made list and delete panel
- **Files:** `app/web/src/components/payments-list.tsx` (new), `app/web/src/components/payments-list.test.tsx` (new)
- **Does:** A "Payments made" subheading, which takes a ref so the section can focus it. "No payments yet." when empty. Otherwise one row per payment reading "{payer} paid {payee} {amount}" with a "Delete payment" button named "Delete payment: {row text}". Delete opens a panel on that row with "Delete this payment? The balances will change as if it had not been paid.", then "Cancel" first and "Delete payment". The panel takes focus when it opens, and Escape closes it. Cancel closes it and sends no request. A confirmed delete removes the row and calls `onChanged`. A `payment_not_found` response shows "This payment is no longer on this trip.", removes the row and calls `onChanged`. Any other failure shows "Could not delete this payment. Try again." and keeps the row. Status messages use a polite live region. "Payment deleted." is shown after a successful delete.
- **Covers:** F6.R9, F6.R10, F6.R11, F6.AC5, F6.AC9, F6.AC10
- **Done when:** `npm test -w app/web -- -t "\bF6\.AC(5|9|10)\b"` passes.

### F6.T13 Settle up panel: suggestions and Mark as paid
- **Files:** `app/web/src/components/settle-up-panel.tsx` (new; renders the Settle up heading, the copy, the suggestions, and `PaymentsList` from T12), `app/web/src/components/settle-up-panel.test.tsx` (new)
- **Does:** The heading "Settle up" and the line "Payments happen outside the app. Marking one as paid only records it here." "Loading payments…" until the first response. The suggestions subheading "Suggested payments", then one row per suggestion with "Mark as paid", named "Mark as paid: {row text}". Success shows "Payment recorded.", calls `onChanged` (so Balances reloads too), and moves focus to "Payments made". The panel reloads when `refreshKey` changes and keeps the current rows until the new ones arrive. A `stale_suggestion` response shows "These balances have changed. Refresh to see the latest suggestions.", records nothing, reloads the suggestions, and calls `onChanged` so the Balances section reloads too (F6.R8). Any other failure shows "Could not record this payment. Try again." and the suggestion stays. Zero balances show "Everyone is even. No payments are needed." in place of suggestions. No people shows "Add people to this trip to settle up." with no suggestions and no payments. A failed load shows "Could not load payments. Try again." with a "Try again" button. After a successful delete (from T12, through `onChanged`), focus moves to the "Settle up" heading.
- **Covers:** F6.R8, F6.R18, F6.R19, F6.AC5, F6.AC6, F6.AC11, F6.AC12, F6.AC15
- **Done when:** `npm test -w app/web -- -t "\bF6\.AC(5|6|11|12|15)\b"` passes.

### F6.T14 Settle up section on the trip page
- **Files:** `app/web/src/app/trips/[id]/page.tsx` (changed: adds the Settle up section below Balances, with `refreshKey={balanceVersion}`, and makes Mark as paid and delete call the existing `balanceVersion` bump), `app/web/src/app/trips/[id]/page.test.tsx` (changed), `app/web/src/lib/route-rules.spec.ts` (changed: a case for a logged-out visitor on a trip page)
- **Does:** The page renders `SettleUpPanel` below Balances, after the trip has loaded. The expense and people changes that already bump `balanceVersion` (F5.T7) also reload Settle up, with no message. The Mark as paid and delete `onChanged` callbacks bump the same counter, so Settle up and Balances reload together. Suggestions are recalculated on every load (F6.R4). F1's route rules send a logged-out visitor to Log in, so the page adds no redirect.
- **Covers:** F6.R4, F6.AC14, F6.AC18
- **Done when:** `npm test -w app/web -- -t "\bF6\.AC(14|18)\b"` passes.

## AC coverage

Every AC in the spec has one row. Two rows are "code review" (AC16 and AC17). The other rows have a unit test, and some also need a code review check, noted below the table.

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F6.AC1 | `app/api/src/domain/settle-rules.spec.ts` | F6.AC1 Example 1 gives Jo pays Sam 40.00, then Alex pays Sam 10.00 | |
| F6.AC2 | `app/api/src/domain/settle-rules.spec.ts` | F6.AC2 after Jo's payment only Alex pays Sam 10.00 remains, and balances add to zero | |
| F6.AC3 | `app/api/src/domain/settle-rules.spec.ts` | F6.AC3 equal largest debts go to the person added first | |
| F6.AC4 | `app/api/src/domain/settle-rules.spec.ts` | F6.AC4 generated zero-sum balances reach zero, every amount is above zero, and the count is at most people with a non-zero balance minus one | |
| F6.AC5 | `app/api/src/payments/payments.service.spec.ts`, `app/web/src/components/settle-up-panel.test.tsx`, `app/web/src/components/payments-list.test.tsx` and `app/web/src/lib/payment-text.spec.ts` | F6.AC5 a matching suggestion is inserted and returned; F6.AC5 Mark as paid shows "Payment recorded." and reloads; F6.AC5 a payment reads "Alex paid Sam 10.00"; F6.AC5 wording has two decimals | |
| F6.AC6 | `app/api/src/domain/payment-rules.spec.ts`, `app/api/src/payments/payments.service.spec.ts`, `app/web/src/lib/api-client.spec.ts` and `app/web/src/components/settle-up-panel.test.tsx` | F6.AC6 payer equal to payee, a missing ID, and a zero, negative or non-integer amount return invalid_payment; F6.AC6 a suggestion matching no current one returns stale_suggestion and inserts nothing; F6.AC6 recordPayment returns stale_suggestion; F6.AC6 stale message shows and suggestions reload; F6.AC6 stale result reloads Balances too | |
| F6.AC7 | `app/api/src/payments/payments.service.spec.ts` | F6.AC7 a second identical record returns stale_suggestion, and one payment exists | Also code review: the write-first transaction against two real connections (F6.T6). A fake cannot run two transactions. |
| F6.AC8 | `app/api/src/domain/balance-rules.spec.ts`, `app/api/src/balances/balances.service.spec.ts` and `app/api/src/payments/payments.service.spec.ts` | F6.AC8 a payment raises the payer's balance and lowers the payee's, and balances add to zero; F6.AC8 balances include recorded payments; F6.AC8 record and delete log no amounts, names or tokens | |
| F6.AC9 | `app/api/src/payments/payments.service.spec.ts` and `app/web/src/components/payments-list.test.tsx` | F6.AC9 a confirmed delete calls the repository once with trip ID and payment ID; F6.AC9 Cancel sends no request and keeps the row; F6.AC9 a confirmed delete removes the row and shows "Payment deleted." | |
| F6.AC10 | `app/api/src/payments/payments.service.spec.ts`, `app/api/src/payments/settle-up.controller.spec.ts`, `app/web/src/lib/api-client.spec.ts` and `app/web/src/components/payments-list.test.tsx` | F6.AC10 a payment not on this trip returns payment_not_found and deletes nothing; F6.AC10 DELETE maps payment_not_found to 404; F6.AC10 deletePayment returns the server code; F6.AC10 an already-deleted payment shows its message and the row is removed | |
| F6.AC11 | `app/api/src/domain/settle-rules.spec.ts`, `app/api/src/payments/payments.service.spec.ts` and `app/web/src/components/settle-up-panel.test.tsx` | F6.AC11 all-zero balances give an empty list; F6.AC11 zero balances give no suggestions; F6.AC11 zero balances show "Everyone is even. No payments are needed." and no suggestions | |
| F6.AC12 | `app/api/src/payments/payments.service.spec.ts` and `app/web/src/components/settle-up-panel.test.tsx` | F6.AC12 a trip with no people returns no suggestions and no payments; F6.AC12 no people shows "Add people to this trip to settle up." and no rows | |
| F6.AC13 | `app/api/src/payments/payments.service.spec.ts` and `app/api/src/payments/settle-up.controller.spec.ts` | F6.AC13 a trip the repositories do not return is not_found and nothing changes; F6.AC13 every payment route is behind the session guard, and no session returns 401 with the handler not called; F6.AC13 no PUT or PATCH route exists for payments | Also code review: the owner filter on every query in `prisma-payment.repository.ts` and `ledger-read.ts` (F6.T4, F6.T6). The fake cannot prove it. |
| F6.AC14 | `app/web/src/lib/route-rules.spec.ts` | F6.AC14 a logged-out visitor on a trip page is sent to Log in | |
| F6.AC15 | `app/api/src/payments/payments.service.spec.ts` and `app/web/src/components/settle-up-panel.test.tsx` | F6.AC15 a repository failure is rethrown and records nothing; F6.AC15 failed Mark as paid shows "Could not record this payment. Try again." and the suggestion stays | |
| F6.AC16 | code review | code review | The in-use check is a real query on payment rows in `prisma-person.repository.ts` (F6.T7). A fake repository returns what the test sets, so it cannot prove the query. Same as F4.AC15. |
| F6.AC17 | code review | code review | The trip cascade and the NoAction person keys are database declarations (F6.T3). A unit test cannot run a delete against them. |
| F6.AC18 | `app/web/src/app/trips/[id]/page.test.tsx` | F6.AC18 an added or deleted expense reloads Settle up with no message | |

Code review also needed for the unit-tested rows:
- **F6.AC7:** the record transaction in `prisma-payment.repository.ts` (F6.T6) takes the write lock before it reads the ledger. Check it with two requests in the running API.
- **F6.AC13:** the trip filter `userId` on each query in `prisma-payment.repository.ts` and in `ledger-read.ts`. A real request for another user's trip returns 404 from the running server.
- **F6.AC16:** a person who is payer or payee of a real payment cannot be removed, once F6.T7 is in.
- **Same-trip rule for payer and payee:** the spec's test plan asks for code review. F6.T6's `decide` checks it against the people read in the same transaction.
- **Keys and indexes:** the payment foreign keys (F6.T3) and the indexes on `payments.tripId`, `payments.payerId` and `payments.payeeId` exist in the migration.

## Out of scope
- Editing a payment (spec: No editing). A mistake is fixed by deleting it and marking the suggestion as paid again.
- Recording a payment that is not a current suggestion (spec: Out).
- Storing suggested payments. They are calculated on each load (F6.R4).
- A guarantee of the fewest payments (R6 is the rule).
- Dates, currency and conversion on payments.
- Payment methods or any transfer inside the app.
- Integration and end-to-end tests (project rules). The spec's test plan lists the two-tab race and the trip-page refresh for browser or database checks. Both are covered by code review or a component test (see the Decisions log).

## Decisions log
- 2026-11-19: Suggestion rule → pure `suggestPayments` in `app/api/src/domain/settle-rules.ts`, integer cents, ties by trip order. Reason: R6 and F6.R2 are tested with plain arrays and need no database.
- 2026-11-19: Payment term → `computeBalances` takes payments as a third argument. F5's calls pass `[]`. Reason: F5's decision left the payment term to F6, which extends this function.
- 2026-11-19: Stale check runs inside the record transaction → the repository takes a pure `decide(ledger)` from the service. Reason: the check and the insert must share one transaction (F6.R7), and the rule stays out of Prisma.
- 2026-11-19: Lock → the first statement of the record transaction is a parameterized no-op `UPDATE` of the owner's trip row (`SET id = id`). Reason: CLAUDE.md says SQLite has no row locks, and the write must come before the read. This takes the write lock first. No data changes, so F6.R17 holds. The spec's "locks the trip's row" is met this way.
- 2026-11-19: Ledger read → one `readLedgerForOwner` helper in the balances module, used by the balance repository and the payment repository. Reason: one snapshot query and one owner filter, not two copies.
- 2026-11-19: Person foreign keys on payments → `onDelete: NoAction`, as F3 and F4 decided, not `Restrict`. The spec's "restrict on delete" holds in behavior: deleting a person who is in a payment fails and maps to `in_use`. Reason: SQLite checks RESTRICT immediately, which would break the trip and account cascades (F1, F2).
- 2026-11-19: Same-trip rule for payer and payee → checked in `decide` against the people read in the same transaction, not by a database constraint. Reason: the schema cannot enforce trip membership with plain foreign keys. The spec allows the transaction check and code review.
- 2026-11-19: Payments list order → `createdAt` descending, then `id` descending, the same as expenses (F4.T6). Reason: spec F6.R9 and the approved default.
- 2026-11-19: Refresh → Settle up sits below Balances, and uses F5's `balanceVersion` counter. Mark as paid and delete bump it, so both sections reload together. Reason: one refresh signal, as F5 set up for expenses and people.
- 2026-11-19: F6.AC7 (two tabs) → a sequential unit test with the fake, and code review for the real concurrent transaction. Reason: a fake cannot run two transactions. Project rules limit code review to what unit tests cannot prove, and the lock is one of those things.
- 2026-11-19: F6.AC18 (expense change refreshes Settle up) → unit test in `page.test.tsx`, not a browser check as the spec's test plan says. Reason: the page test proves the refresh call directly, as F5.AC7 does. The spec is not changed.
- 2026-11-19: F6.R12 (no editing) has no AC of its own → its no-PUT and no-PATCH test is named under F6.AC13 with the route tests. Reason: the spec gives R12 no AC ID, and F3.AC13 handles the same case the same way.
- 2026-11-19: Logging test → named F6.AC8, as the spec's test plan maps it. Reason: the spec's mapping, followed as written.
- 2026-11-19: F6.AC16 and F6.AC17 → code review. Reason: the in-use query and the cascade and NoAction foreign keys are database behavior that fakes cannot prove (F3.AC17 and F4.AC15 set the same precedent).
- 2026-11-19: Migration F6.T3 and removal change F6.T7 → need a person to read and approve before merge. Reason: project rules list database migrations and changes to the removal path.
- 2026-11-19: Stale result reloads Balances → `stale_suggestion` calls `onChanged`, as Mark as paid success does. Reason: F6.R8 says the Balances section also reloads. Test: "F6.AC6 stale result reloads Balances too".
- 2026-11-19: Delete is one `$transaction` (owner-scoped trip read, then `deleteMany`). Reason: F6.R10 says deleting removes the row in one transaction. The read and the delete then see the same owner check, so a trip cannot change between them.
- 2026-11-19: Plan approved by the user; status set to Approved.
- 2026-11-19: Plan drafted from the approved spec. No product question came up in planning.
