# F5 — Balances

_Status: Approved · Last updated: 2026-11-19 · Source: product.md — MVP scope (F5), Key terms (Balance), Business rules R4–R5, Worked examples 1–2, Assumptions (Amounts are whole cents), Ownership rule_

## Summary
A logged-in user opens a trip and sees each person's balance: how much they are owed, how much they owe, or that they are even. The balances come from the expenses and people already on the trip. The app does not store balances; it works them out from the saved expenses, so they always match the shares the user saw. Balances update when an expense is added or deleted. All balances on a trip add up to exactly zero (R5). F6 (Settle up) uses these balances to suggest payments.

## User stories
- As a user, I want to see how much each person is owed or owes, so that I know who should be paid back.
- As a user, I want a person with nothing owed either way to show as even, so that I do not mistake them for someone who owes money.
- As a user, I want the balances to update after I add or delete an expense, so that the figures stay current without a reload.
- As a user, I want the balances to be correct to the cent, so that I can trust them when money is paid back.

## Scope
**In:**
- A Balances section on the trip page (`/trips/:id`), below the Expenses section.
- One row per person on the trip, showing the person's name and their balance in words and cents: "is owed", "owes", or "is even".
- Row order: the order people were added to the trip (the same order as the People section).
- Balance formula from R4, with payments term fixed at zero until F6 adds payments.
- A read-only API endpoint for the trip's balances.
- Ownership check on the balances request, through the trip (same rules as F2–F4).

**Out:**
- Suggested payments and marking payments as paid. These are F6.
- Paid and share figures per person in the balances section. Shares stay in the Expenses list (F4).
- A visible total line. The sum is guaranteed by the calculation and tested; it is not shown (see Decisions log).
- Currency, conversion, or rounding of balances. Balances are whole cents already.
- Editing balances. Balances are never typed in; they change only through expenses and payments.

## User flow & screens
1. The user opens a trip (`/trips/:id`). Below the Expenses section, the Balances section shows a loading message, then one row per person.
2. Each row reads with the person's name first, then the balance. Examples: "Sam is owed 50.00", "Alex owes 10.00", "Jo is even".
3. The user adds or deletes an expense in the Expenses section, or adds or removes a person in the People section. The Balances section refreshes to the new figures without a page reload. A newly added person appears as "is even"; a removed person disappears. No message is shown for these changes.
4. If the trip has no people, the Balances section shows a message in place of rows.
5. If balances cannot be loaded, the section shows an error message and a "Try again" button. Retrying reloads the balances.

Screens: none in `docs/design` yet. The trip page layout is the one F2–F4 define.

**Proposed wording for the section** (approved by the user as written on 2026-11-17):
- Section heading: "Balances"
- Row, owed: "{name} is owed {amount}"
- Row, owes: "{name} owes {amount}"
- Row, even: "{name} is even"

## Requirements
- **F5.R1** A balance is computed per person on a trip as: the total of expenses that person paid, minus the total of their shares in all expenses, plus payments they made, minus payments they received (product.md R4). Payments are added in F6; until then the payment terms are zero. _Stated:_ R4. _Inferable:_ payments are zero before F6 exists (build order).
- **F5.R2** Balances are calculated from the saved expenses, payers and shares (F4.R1, F4.R6). They are not stored in the database and are not typed in by the user. _Derived:_ F4's Data section says shares are stored so balances read the numbers the user saw.
- **F5.R3** All balances on a trip add up to exactly zero (product.md R5). This holds because each expense's shares add up to its amount (F4.R6), so the total of paid minus shares is zero for each expense. The calculation is tested with the worked examples.
- **F5.R4** A person with a positive balance is shown as "is owed" with the amount. A person with a negative balance is shown as "owes" with the absolute amount. A person with a zero balance is shown as "is even" with no amount. Copy is in the User flow section.
- **F5.R5** Amounts are shown with two decimal places, as in the worked examples (for example "50.00", "3.33").
- **F5.R6** Rows are listed in the order people were added to the trip, the same order as the People section (F3). _Derived:_ the same order is used for leftover cents in F4.R6.
- **F5.R7** The Balances section lists every person on the trip, including people with no expenses. A person with no expenses is shown as "is even".
- **F5.R8** Each balance row shows only the name and the balance. Paid and share figures are not shown in this section.
- **F5.R9** The balances request checks that the trip belongs to the logged-in user. A trip that is not theirs, or does not exist, returns "not found", the same as F2.R9 and F4.R11.
- **F5.R10** The balances are read-only. No request in this feature changes an expense, a person or a payment.
- **F5.R11** When the trip has no people, the section shows "Add people to this trip to see balances." instead of rows. No balance row is shown.
- **F5.R12** When balances cannot be loaded, the section shows "Could not load balances. Try again." with a "Try again" button. The section does not show stale or partial figures.
- **F5.R13** After an expense is added or deleted, or a person is added or removed, the Balances section shows the new figures without a page reload. A newly added person shows as "is even". A removed person no longer appears. No message is shown.

## Data & contract
**No new tables.** Balances are read from `people`, `expenses` (F4) and `expense_shares` (F4). The payments term is read from `payments` once F6 creates that table; until then it is treated as zero.

**API** (path is the proposed shape, matching F4's expense routes):

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/trips/:id/balances` | none | 200 `{ "balances": [{ "person_id", "name", "balance_cents" }] }`, in the order people were added to the trip | 404 `{ "error": "not_found" }`; 401 |

- `balance_cents` is an integer. Positive means owed; negative means owes; zero means even. The UI turns these into the copy in the User flow section.
- A trip with no people returns 200 with `"balances": []`.
- Error shape for all errors: `{ "error": "<code>" }`. The UI maps any failure to F5.R12's message.
- The API never returns 403 for balances (same as F3.R14 and F4).

**Browser storage:** None. The session cookie is F1's.

## States & errors
**Copy below was proposed and approved by the user as written on 2026-11-17.**

| State | What the user sees |
|---|---|
| Loading balances | "Loading balances…" |
| Trip has no people | "Add people to this trip to see balances." (no rows) |
| Row, owed | "{name} is owed {amount}" |
| Row, owes | "{name} owes {amount}" |
| Row, even | "{name} is even" |
| Load fails (network or server) | "Could not load balances. Try again." with a "Try again" button |
| Trip not found (missing or not theirs) | Page: "This trip could not be found." with a "Back to trips" link (F2) |
| Logged out | Redirect to Log in (F1) |
| Session expired during a request | Redirect to Log in (F1) |

- **Loading:** the section shows "Loading balances…" until the first response arrives. Refreshes after an expense change keep the current rows visible until the new figures arrive.
- **Empty state:** when the trip has people but no expenses, every person shows "is even". The empty-state message above applies only when there are no people.

## Accessibility
- The section has a visible heading "Balances" and is reachable by keyboard in the normal tab order.
- Each balance row is plain text. The direction ("is owed", "owes", "is even") is in words, not only in color or position.
- The "Try again" button is a real button with the visible label "Try again".
- After a failed load, focus stays on the "Try again" button.
- Refreshes after an expense change update the rows without moving focus. The rows are not announced on every refresh.
- Colors meet WCAG AA contrast for text. No animation is required.

## Edge cases
- **Payer who is not a participant** (R2): the payer's balance includes what they paid with no share. Example: Sam pays 30.00 for a taxi shared by Alex only. Sam is owed 30.00; Alex owes 30.00.
- **Rounding** (Example 2): 10.00 shared by Sam, Alex and Jo gives shares of 3.34, 3.33 and 3.33. Sam's balance is 6.66 (paid 10.00 minus share 3.34); Alex owes 3.33; Jo owes 3.33. The three add up to zero.
- **A person whose balance comes to zero** after several expenses shows "is even".
- **A person with no expenses** shows "is even" (F5.R7).
- **Deleting an expense** changes the balances on the next refresh, and a person whose only expense was deleted shows "is even".
- **Large values:** the sum of many expenses can be larger than one expense's maximum (1,000,000.00 each, R11). Integer cents cover this range; no overflow is expected at this scale.
- **Trip with people and no expenses:** every row shows "is even"; the total is zero.
- **Balance sum is not zero:** R5 holds by construction, so this should not happen. If it ever does, the server logs it (without personal data) and still returns the balances. The API does not return an error for this case. R5 is covered by unit tests using the worked examples.
- **Person removed then re-added with the same name** is a new person (F3), with a new balance starting at zero.

## Acceptance criteria
- **F5.AC1** Given Sam paid 90.00 for dinner and Alex paid 30.00 for a taxi, both shared equally by Sam, Alex and Jo, when the balances are calculated, then Sam is owed 50.00, Alex owes 10.00, and Jo owes 40.00. _(R4; Example 1)_
- **F5.AC2** Given Example 2 (10.00 shared by Sam, Alex and Jo, with Sam as payer), when the balances are calculated, then the balances are 6.66, −3.33 and −3.33, and they add up to zero. _(R3, R5; Example 2)_
- **F5.AC3** Given any set of expenses on a trip, when the balances are calculated, then they add up to exactly zero. _(R5)_
- **F5.AC4** Given a balance of 50.00, when the row is shown, then it reads "is owed 50.00". Given a balance of −10.00, then it reads "owes 10.00". Given a balance of zero, then it reads "is even" with no amount. _(F5.R4)_
- **F5.AC5** Given a trip with people and no expenses, when the balances are shown, then every person is shown as "is even". _(F5.R7)_
- **F5.AC6** Given a trip with no people, when the Balances section loads, then it shows "Add people to this trip to see balances." and no rows. _(F5.R11)_
- **F5.AC7** Given a user adds or deletes an expense, or adds or removes a person, when the change is saved, then the Balances section shows the new figures without a page reload. A newly added person shows as "is even", and a removed person no longer appears. _(F5.R13)_
- **F5.AC8** Given the balances request fails, when the section is shown, then it shows "Could not load balances. Try again." with a "Try again" button and no rows. _(F5.R12)_
- **F5.AC9** Given a trip that is not owned by the logged-in user, when its balances are requested, then the response is "not found", and no balances are shown. _(F5.R9; checked by code review)_
- **F5.AC10** Given a person is removed and re-added, when the balances are shown, then the new person starts at zero. _(Edge cases; F3)_

## Dependencies
- **F3 (People):** balances are per person; uses people and their added order (F5.R6).
- **F4 (Expenses):** reads the expenses, payers and saved shares (F5.R2). Balances need F4 to be built first.
- **F6 (Settle up):** adds the payment terms to F5.R1 and reads these balances to suggest payments. F5 must not change once F6 adds payments, except for the payments term.
- **F1 (Login) and F2 (Trips):** login and trip ownership checks (F5.R9).
- **Build order:** step 5, after F4 (expenses). F6 depends on this feature.
- **External services:** none.

## Test plan
Unit tests only (project rules), mapped to AC IDs. Ownership and the not-found response are checked by code review.

- **Balance calculation** (pure function, no database), covering:
  - F5.AC1: Example 1 balances (50.00, −10.00, −40.00).
  - F5.AC2: Example 2 balances (6.66, −3.33, −3.33).
  - F5.AC3: a property-style test with several random sets of expenses, checking the balances add up to zero.
  - Payer who is not a participant (edge case: Sam owed 30.00; Alex owes 30.00).
  - Deleting an expense (the balance returns to zero for a person with no other expenses).
  - F5.AC5: people with no expenses are zero.
- **Formatting** (pure function), covering:
  - F5.AC4: "is owed 50.00", "owes 10.00", and "is even" for zero.
  - F5.R5: two decimal places, including values like 3.30 and 0.05.
- **Response shape** (unit test of the balances handler, mocked data): F5.R6 order and F5.R11 empty trip.
- **Client state** (unit test): F5.AC8 error message and "Try again", and F5.AC6 empty trip message.
- **Code review:** F5.AC7 refresh after add or delete; F5.AC9 ownership and not-found; F5.AC10 re-added person.

## Open questions
- [x] Should balance amounts use a thousands separator, such as "1,250.00"? → No. Amounts are shown without one, consistent with F4 (F5.R5).
- [x] Should the API return an error when balances do not add up to zero? → No. The server logs it and still returns the balances (see Edge cases).

## Decisions log
- 2026-11-17: Copy for the Balances section (heading, rows, empty and error messages, "Try again"): approved as proposed by the user.
- 2026-11-17: Wording for a zero balance? → "is even".
- 2026-11-17: Row order? → Order people were added to the trip.
- 2026-11-17: Detail per row? → Balance only (name and balance); paid and share figures stay in the Expenses list.
- 2026-11-17: Visible total line that should read 0.00? → No. The sum is tested, not shown.
- 2026-11-17: Spec saved as Draft.
- 2026-11-17: Thousands separator in balance amounts? → No; consistent with F4.
- 2026-11-17: Return an API error if balances do not add up to zero? → No. Log on the server and still return the balances. R5 is covered by unit tests with the worked examples.
- 2026-11-17: Balances section placement? → Below Expenses on the trip page.
- 2026-11-17: API route? → `GET /api/trips/:id/balances`.
- 2026-11-17: Payment term before F6? → Counted as zero until F6 adds payments.
- 2026-11-17: Spec approved by the user; status set to Approved.
- 2026-11-19: Adding or removing a person refreshes the Balances section without a page reload, with no message (a new person shows as "is even", a removed person disappears)? → Yes. F5.R13, User flow step 3 and F5.AC7 updated. Nothing else changed. Substance changed, so status set back to Draft; the plan in docs/plans/ may need updating.
- 2026-11-19: Spec approved by the user; status set back to Approved.
