# F5 — Balances

_Status: Approved · Last updated: 2026-11-19 · Spec: [F5-balances.md](../specs/features/F5-balances.md)_

## Summary
This plan adds balances (build order step 5). It adds a pure balance calculation, one owner-scoped read of a trip's people and expenses, a service tested with fake repositories, a read-only GET endpoint behind F1's session guard, and the Balances section below Expenses on the trip page. It adds no tables and no migration: balances are worked out from F3 and F4 data and never stored. The payment term stays out until F6 adds it.

Shared work reused, not planned again: the Prisma service and `Trip` ownership pattern (F1.T2, F2.T3), the `SessionGuard` (F1.T9), the web API client and route rules (F1.T11, F2.T7), `formatCents` (F4.T11), the people order used by the repositories (F3.T3, F4.T4), the expense list and the trip page with its not-found state (F4.T13, F4.T14, F2.T10).

Notes for review:
- F5 adds no migration and changes no authentication code.
- The owner filter in the balances read is the ownership check for this feature. A person checks it in code review (F5.AC9).

## Tasks

### F5.T1 Balance calculation (pure domain)
- **Files:** `app/api/src/domain/balance-rules.ts` (new), `app/api/src/domain/balance-rules.spec.ts` (new)
- **Does:** `computeBalances(people, expenses)` takes people `{ id }` in trip order and expenses `{ payerId, amountCents, shares: { personId, shareCents }[] }`. It returns `{ personId, balanceCents }` for each person, in the order given. A person's balance is what they paid minus their shares (R1, with the payment term left out until F6). A person with no expenses gets zero. Integer cents only. `sumIsZero(balances)` returns whether the balances add up to exactly zero. The property test uses a fixed-seed generator written in the test file, with random payers and random shares that add up to each amount. No Nest or Prisma imports.
- **Covers:** F5.R1, F5.R2, F5.R3, F5.R7, F5.AC1, F5.AC2, F5.AC3, F5.AC5, F5.AC10
- **Done when:** `npm test -w app/api -- -t "\bF5\.AC(1|2|3|5|10)\b"` passes.

### F5.T2 Balance wording (web, pure)
- **Files:** `app/web/src/lib/balance-text.ts` (new), `app/web/src/lib/balance-text.spec.ts` (new)
- **Does:** `balanceText(name, balanceCents)` returns "{name} is owed {amount}" for a positive balance, "{name} owes {amount}" for a negative one (with the absolute amount), and "{name} is even" for zero (with no amount). The amount comes from `formatCents` (F4.T11), so it has two decimals and no floating-point math. No thousands separator.
- **Covers:** F5.R4, F5.R5, F5.AC4
- **Done when:** `npm test -w app/web -- -t "\bF5\.AC4\b"` passes.

### F5.T3 Balance repository interface and Prisma adapter
- **Files:** `app/api/src/balances/balance.repository.ts` (new, interface), `app/api/src/balances/prisma-balance.repository.ts` (new)
- **Does:** Interface `BalanceRepository` with `loadForOwner(userId, tripId)`. It returns `{ people: { id, name }[], expenses: { payerId, amountCents, shares: { personId, shareCents }[] }[] }`, or `null` when the trip is not the owner's. People come in trip order (`createdAt`, then `id`), as F4.T4 does. The Prisma version reads the trip, its people, its expenses and their shares inside one `$transaction`, so all of them come from one snapshot. The trip is found by `id` and `userId` together. Parameterized calls only. A malformed ID matches no row and returns `null`. Nothing is written.
- **Covers:** F5.R2, F5.R6, F5.R9, F5.AC9
- **Done when:** `npm run build -w app/api` exits 0. Code review checks the owner filter on the query (see the notes under the coverage table).

### F5.T4 Balances service with fake repository and logging
- **Files:** `app/api/src/balances/balances.service.ts` (new; defines `BalanceError`), `app/api/src/balances/balances.service.spec.ts` (new), `app/api/src/balances/balance-logger.ts` (new, port wrapping Nest `Logger`)
- **Does:** `forTrip(userId, tripId)` calls `loadForOwner`. A `null` result logs a not-found event and throws `BalanceError('not_found')`. Otherwise it runs `computeBalances` (T1) and returns `{ personId, name, balanceCents }` for each person, in added order. If `sumIsZero` is false, it logs a warning with the trip ID only and still returns the balances. It logs list, not-found and sum-mismatch events with user ID and trip ID only, never a name, an amount, or a token. Tests use an in-memory fake `BalanceRepository` that models trip owners, people and expenses. The service depends only on the interface.
- **Covers:** F5.R6, F5.R9, F5.AC3, F5.AC5, F5.AC6, F5.AC9
- **Done when:** `npm test -w app/api -- -t "\bF5\.AC(3|5|6|9)\b"` passes.

### F5.T5 Balances endpoint behind the session guard
- **Files:** `app/api/src/balances/balances.controller.ts` (new), `app/api/src/balances/balances.controller.spec.ts` (new), `app/api/src/balances/balances.module.ts` (new, provides `BalanceRepository` with the Prisma adapter and the service, and uses F1's guard), `app/api/src/app.module.ts` (changed, imports `BalancesModule`)
- **Does:** `@Controller('trips/:id/balances')` with `SessionGuard` on the class, so the route is guarded. One route: GET (200) returns `{ "balances": [{ "person_id", "name", "balance_cents" }] }`, with `balance_cents` as an integer and people in added order. An empty trip returns `"balances": []`. The owner always comes from the guard's `userId`. `BalanceError` `not_found` maps to 404 `{ "error": "not_found" }`. Any other error reaches the error handler. No write route exists, so the endpoint is read-only (R10).
- **Covers:** F5.R9, F5.R10, F5.AC5, F5.AC6, F5.AC9
- **Done when:** `npm test -w app/api -- -t "\bF5\.AC(5|6|9)\b"` passes.

### F5.T6 Balances API client and Balances panel
- **Files:** `app/web/src/lib/api-client.ts` (changed: `listBalances`), `app/web/src/lib/api-client.spec.ts` (changed), `app/web/src/components/balances-panel.tsx` (new), `app/web/src/components/balances-panel.test.tsx` (new)
- **Does:** `listBalances(tripId)` calls the endpoint with `credentials: 'same-origin'` and returns the balances, or the server's `error` code. `BalancesPanel` takes `tripId` and `refreshKey`. It shows a visible "Balances" heading. It shows "Loading balances…" until the first response, then one row per balance, each built with `balanceText` (T2) and showing only the name and the balance. With an empty list it shows "Add people to this trip to see balances." and no rows. When `refreshKey` changes, it reloads and keeps the current rows until the new ones arrive. A failed load, including a failed refresh, clears the rows and shows "Could not load balances. Try again." with a "Try again" button. After a failed load, focus stays on that button. Refreshes do not move focus or announce the rows.
- **Covers:** F5.R8, F5.R11, F5.R12, F5.AC4, F5.AC6, F5.AC7, F5.AC8
- **Done when:** `npm test -w app/web -- -t "\bF5\.AC(4|6|7|8)\b"` passes.

### F5.T7 Balances section on the trip page
- **Files:** `app/web/src/app/trips/[id]/page.tsx` (changed: adds the Balances section below the Expenses section, and a `balanceVersion` counter), `app/web/src/app/trips/[id]/page.test.tsx` (changed), `app/web/src/components/expense-list.tsx` (changed: new `onChanged` prop), `app/web/src/components/expense-list.test.tsx` (changed), `app/web/src/components/people-list.tsx` (changed: new `onChanged` prop), `app/web/src/components/people-list.test.tsx` (changed)
- **Does:** The page renders `BalancesPanel` below Expenses, once the trip has loaded, with `refreshKey={balanceVersion}`. Five callbacks each increase `balanceVersion`, so the panel reloads without a page reload: the expense form's `onAdded`, the expense list's new `onChanged` (called once after a confirmed delete), the add person form's `onAdded` (F3.T9), and the people list's new `onChanged` (called once after a successful removal). A new person therefore shows as "is even" and a removed person disappears from the balances. No change shows a message. F2's not-found state, F3's people behavior and F4's expense behavior stay as they are.
- **Covers:** F5.R7, F5.R13, F5.AC7
- **Done when:** `npm test -w app/web -- -t "\bF5\.AC7\b"` passes.

## AC coverage

Every AC in the spec has one row. None is "code review" alone. AC9 also needs a code review check, noted below the table.

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F5.AC1 | `app/api/src/domain/balance-rules.spec.ts` | F5.AC1 Example 1 gives 50.00, -10.00 and -40.00; F5.AC1 payer who is not a participant is owed the full amount | |
| F5.AC2 | `app/api/src/domain/balance-rules.spec.ts` | F5.AC2 Example 2 gives 6.66, -3.33 and -3.33 that add to zero | |
| F5.AC3 | `app/api/src/domain/balance-rules.spec.ts` and `app/api/src/balances/balances.service.spec.ts` | F5.AC3 random expense sets always add to zero; F5.AC3 deleting an expense leaves the rest adding to zero; F5.AC3 a sum that is not zero is logged with IDs only and balances are still returned | |
| F5.AC4 | `app/web/src/lib/balance-text.spec.ts` and `app/web/src/components/balances-panel.test.tsx` | F5.AC4 "is owed", "owes" and "is even" wording; F5.AC4 shows 3.30 and 0.05 with two decimals; F5.AC4 each row reads the name first and shows only name and balance | |
| F5.AC5 | `app/api/src/domain/balance-rules.spec.ts`, `app/api/src/balances/balances.service.spec.ts` and `app/api/src/balances/balances.controller.spec.ts` | F5.AC5 people with no expenses are zero; F5.AC5 lists people in added order; F5.AC5 response has person_id, name and integer balance_cents | |
| F5.AC6 | `app/api/src/balances/balances.service.spec.ts`, `app/api/src/balances/balances.controller.spec.ts` and `app/web/src/components/balances-panel.test.tsx` | F5.AC6 a trip with no people returns an empty list; F5.AC6 empty trip returns 200 with an empty balances array; F5.AC6 no people shows the message and no rows | |
| F5.AC7 | `app/web/src/components/balances-panel.test.tsx`, `app/web/src/app/trips/[id]/page.test.tsx`, `app/web/src/components/expense-list.test.tsx` and `app/web/src/components/people-list.test.tsx` | F5.AC7 a changed refreshKey reloads and keeps the old rows until the new ones arrive; F5.AC7 adding or deleting an expense reloads the balances; F5.AC7 adding or removing a person reloads the balances; F5.AC7 a confirmed delete calls onChanged once; F5.AC7 a successful removal calls onChanged once | |
| F5.AC8 | `app/web/src/lib/api-client.spec.ts` and `app/web/src/components/balances-panel.test.tsx` | F5.AC8 listBalances returns the balances, and a failed request returns the server error code; F5.AC8 failed load shows "Could not load balances. Try again." with Try again, no rows, and focus stays on Try again | |
| F5.AC9 | `app/api/src/balances/balances.service.spec.ts` and `app/api/src/balances/balances.controller.spec.ts` | F5.AC9 a trip the repository does not return throws not_found and logs IDs only; F5.AC9 an unknown or not-owned trip returns 404 not_found; F5.AC9 every balances route is behind the session guard | Also code review: the owner filter on the trip query in `prisma-balance.repository.ts` (F5.T3). The fake repository cannot prove it. |
| F5.AC10 | `app/api/src/domain/balance-rules.spec.ts` | F5.AC10 a re-added person with a new ID starts at zero | |

Code review also needed for the unit-tested rows:
- **F5.AC9:** the trip query in `prisma-balance.repository.ts` (F5.T3) finds the trip by `id` and `userId` together. A real request for another user's trip returns 404 from the running server.

## Out of scope
- Suggested payments, marking payments as paid, and the payment term in the balance calculation (F6).
- Paid and share figures per person in the Balances section. Shares stay in the Expenses list (F4).
- A visible total line.
- Currency, conversion, rounding changes, and a thousands separator.
- Editing balances, and any write route for balances.
- Integration and end-to-end tests (project rules).

## Decisions log
- 2026-11-19: Balance calculation → pure `computeBalances` in `app/api/src/domain/balance-rules.ts`, signed integer cents, people in the order given. Reason: the rule is tested with plain arrays and needs no database.
- 2026-11-19: Payment term → left out of `computeBalances` until F6 adds it. Reason: the spec says payments count as zero until F6. F6 extends this function and its tests.
- 2026-11-19: Balance read → one owner-scoped read of the trip's people, expenses and shares inside one `$transaction`. Reason: one ownership filter, and one snapshot, so a write during the read cannot break R5.
- 2026-11-19: Storage → nothing stored, so no migration. Reason: the spec says balances are never stored and F5 creates no tables.
- 2026-11-19: Sum that is not zero → logged with the trip ID only, and the balances are still returned. Reason: the spec's edge case.
- 2026-11-19: AC7 and AC10 → unit tests, not code review. The spec's test plan lists them for code review, but project rules limit code review to ownership checks, database constraints and cascading deletes. Both are provable with a component or plain data. The spec is not changed.
- 2026-11-19: Expense list → gets an `onChanged` prop, called after a confirmed delete. Reason: the page needs a signal after a delete, and F4's list had none.
- 2026-11-19: People changes reload balances → adding a person (F3 add form's `onAdded`) and removing one (people list's new `onChanged`, called after a successful removal) also bump `balanceVersion`. Reason: the user's review decision, so that a new person appears as "is even" and a removed person disappears without a reload, and the rows match the trip's people. The spec now says this in F5.R13, User flow step 3 and F5.AC7 (spec approved again 2026-11-19), so the plan matches it.
- 2026-11-19: Plan approved by the user; status set to Approved.
- 2026-11-19: Plan checked against the approved spec. Covers lists now include F5.R10 (T5). No task or AC row changed otherwise.
- 2026-11-19: Money text → `formatCents` from F4.T11, with no floating-point math. Reason: F4.AC16 and spec R5.
- 2026-11-19: Edge-case tests → each carries the nearest AC ID. Reason: project rules require tests to name an AC.
- 2026-11-19: Plan drafted from the approved spec. No product question came up in planning.
