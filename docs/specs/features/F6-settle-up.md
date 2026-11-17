# F6 — Settle up

_Status: Approved · Last updated: 2026-11-17 · Source: product.md — MVP scope (F6), Key terms (Suggested payment, Payment), Business rules R4–R7, Worked examples 1 and 3, Assumptions (Money moves outside the app, No editing, Amounts are whole cents, Expenses have no date), Ownership rule_

## Summary
A logged-in user opens a trip and sees a short list of suggested payments that would bring every balance to zero (R6). The user marks a suggested payment as paid, which records it. Recorded payments appear in a list, and the user can delete one after confirming. Recording a payment changes the balances (F5), so the suggestions are recalculated from the current balances. Money moves outside the app; the app only records that a payment was made.

## User stories
- As a user, I want to see who should pay whom and how much, so that the trip can be settled.
- As a user, I want to mark a suggested payment as paid, so that the balances update to show what is left.
- As a user, I want to see the payments I have recorded, so that I can check them.
- As a user, I want to delete a payment I recorded by mistake, after confirming, so that I do not remove one by accident.
- As a user, I want to be told when the suggestions have changed, so that I do not record a payment that no longer applies.

## Scope
**In:**
- A Settle up section on the trip page (`/trips/:id`), below the Balances section (F5).
- Suggested payments computed from the current balances, using R6.
- "Mark as paid" on each suggested payment. The server records it only if it still matches a current suggestion.
- A "Payments made" list, newest first, with a "Delete payment" button on each row.
- Delete payment after a confirmation step.
- The `payments` table, which F3's "in use" check reads (F3.R10).
- Ownership check on every payment request, through the trip (same rules as F2–F5).

**Out:**
- Editing a payment. A mistake is fixed by deleting it and marking the suggestion as paid again (product.md Assumptions: No editing).
- Recording a payment that is not one of the current suggestions, such as a custom amount or a payment to a different person. Product.md defines a payment as a suggested payment the user marks as paid.
- Recording any money transfer in the app or any payment method (product.md Assumptions: Money moves outside the app).
- A guarantee of the fewest possible payments. R6 is the rule; the Overview and Goals in product.md are updated to match (see product.md changes applied).
- Dates on payments (product.md Assumptions: no date).
- Currency or conversion (product.md Assumptions: One currency).

## User flow & screens
1. The user opens a trip (`/trips/:id`). Below the Balances section, the Settle up section shows a loading message, then the suggested payments and the Payments made list.
2. Each suggested payment reads "{payer} pays {payee} {amount}" with a "Mark as paid" button. Example from Example 1: "Jo pays Sam 40.00", then "Alex pays Sam 10.00".
3. The user selects "Mark as paid". The payment is recorded. The row moves to the Payments made list as "{payer} paid {payee} {amount}". "Payment recorded." is shown. The Settle up and Balances sections refresh to the new figures.
4. If the suggestion no longer matches the current balances (for example, another tab changed them), nothing is recorded, the message "These balances have changed. Refresh to see the latest suggestions." is shown, and the suggestions are reloaded.
5. The user selects "Delete payment" on a row. A confirmation panel opens on that row. "Cancel" closes it and changes nothing. "Delete payment" removes the payment and shows "Payment deleted." The balances and suggestions refresh; the suggestion for that payment returns if it still applies.
6. When every balance is zero, the suggestions list shows "Everyone is even. No payments are needed."
7. If the trip has no people, the section shows "Add people to this trip to settle up." and no suggestions or payments.
8. Expense changes in the Expenses section also refresh the Settle up section, without a message (same rule as F5.R13).

Screens: none in `docs/design` yet. The trip page layout is the one F2–F5 define.

## Requirements
- **F6.R1** Suggested payments are calculated from the current balances (F5.R1, with the payments term included), using the rule in product.md R6. _Stated:_ R6, MVP scope (F6).
- **F6.R2** The calculation is: while any person has a negative balance (owes), take the person who owes the most and the person who is owed the most, and suggest a payment of the smaller of the two amounts from the first to the second. Reduce both by that amount and repeat until no balance is negative. Ties in amount are broken by the order people were added to the trip (the same order as F3 and F5.R6). _Derived:_ R6; the tie rule is the default accepted in the Decisions log.
- **F6.R3** Each suggested payment has an amount greater than zero. The list has at most one fewer item than the number of people on the trip with a non-zero balance. _Inferable:_ each step zeroes at least one person. The list is a short list, not guaranteed to be the fewest possible (Decisions log).
- **F6.R4** Suggested payments are not stored. They are calculated from the balances each time the section loads or refreshes. _Stated:_ product.md Example 3 (after a payment, the remaining suggestion is recalculated).
- **F6.R5** Marking a suggested payment as paid records a payment with a payer, a payee and an amount in cents. The payer and payee are different people on the same trip.
- **F6.R6** The server records a payment only if, at the time of the request, the trip's current suggested payments include one with exactly the same payer, payee and amount. Otherwise nothing is recorded and the request returns a stale-suggestion result (F6.R8). _Decided:_ Decisions log, 2026-11-17.
- **F6.R7** The check in F6.R6 and the insert happen in one transaction that locks the trip's row, so two requests cannot both record the same suggestion. _Derived:_ the same rule as F3.R11.
- **F6.R8** A stale suggestion returns a conflict result, and the UI shows "These balances have changed. Refresh to see the latest suggestions." The Settle up section then reloads its suggestions. The Balances section also reloads.
- **F6.R9** Recorded payments are listed under "Payments made", newest added first (the same order as expenses, F4.R7). Each row shows the payer, the payee and the amount.
- **F6.R10** Deleting a payment requires the confirmation step in F6.R11. Deleting removes the payment row in one transaction. It cannot be undone; a deleted payment can be recorded again by marking its suggestion as paid, if the suggestion is still current.
- **F6.R11** The delete confirmation panel shows the sentence "Delete this payment? The balances will change as if it had not been paid." and offers "Cancel" and "Delete payment". Cancel makes no change.
- **F6.R12** Payments are never edited. There is no route or screen that changes a payment after it is recorded (product.md Assumptions: No editing).
- **F6.R13** Payments count in the balances (F5.R1). Each payment adds its amount to the payer's balance and subtracts it from the payee's balance, so the balances still add up to exactly zero (R5).
- **F6.R14** Every payment request checks that the trip belongs to the logged-in user. A trip that is not theirs, or does not exist, returns "not found" (F2.R9). A payment on another trip is treated as not found for that trip's requests (product.md Ownership rule).
- **F6.R15** A person who is the payer or payee of a payment cannot be removed (F3.R10, product.md R7). Deleting the last payment that includes a person makes that person removable again (F3.AC10).
- **F6.R16** Amounts are whole cents, never floating-point numbers (product.md Assumptions).
- **F6.R17** Payments change only the `payments` table. No request in this feature changes an expense, its shares or a person.
- **F6.R18** When the trip has no people, the section shows "Add people to this trip to settle up." and no suggestions or payments.
- **F6.R19** When every balance is zero, the suggestions list is empty and the section shows "Everyone is even. No payments are needed." This also holds after all suggested payments are marked paid (product.md MVP scope, F6 Done when).

## Data & contract
**Table `payments`** (new):

| Column | Type | Rules |
|---|---|---|
| `id` | unique ID | Primary key |
| `trip_id` | reference to `trips.id` | Required. Deleting the trip deletes its payments (F2.R7) |
| `payer_id` | reference to `people.id` | Required. Must be a person on the same trip. Restrict on delete: a person with a payment cannot be deleted (F3.R10) |
| `payee_id` | reference to `people.id` | Required. Must be a person on the same trip, and different from `payer_id`. Restrict on delete (F3.R10) |
| `amount_cents` | integer | Required. Greater than zero (F6.R3). No upper limit is set beyond the integer range (see Edge cases) |
| `created_at` | timestamp | Set on insert. Sort key for the list, newest first (F6.R9). Ties broken by `id` |

Index on `payments.trip_id`. Index on `payments.payer_id` and `payments.payee_id`, so the "in use" check for F3 is fast. The payer and payee must be on the trip; the transaction in F6.R7 checks this. The "same trip" rule is covered by code review (see Test plan).

**Suggested payments** are not stored (F6.R4). They are calculated from the balances (F5) in the same transaction as the check in F6.R6.

**API** (paths are the proposed shape, matching F4 and F5):

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/trips/:id/settle-up` | none | 200 `{ "suggestions": [{ "payer": { "id", "name" }, "payee": { "id", "name" }, "amount_cents" }], "payments": [{ "id", "payer": { "id", "name" }, "payee": { "id", "name" }, "amount_cents" }] }`. Suggestions in the order they are calculated (F6.R2). Payments newest added first | 404 `{ "error": "not_found" }`; 401 |
| POST | `/api/trips/:id/payments` | `{ "payer_id": string, "payee_id": string, "amount_cents": integer }` | 201 `{ "payment": { "id", "payer": { "id", "name" }, "payee": { "id", "name" }, "amount_cents" } }` | 400 `{ "error": "invalid_payment" }` (missing or unknown IDs, payer equal to payee, amount not a positive integer); 404 `{ "error": "not_found" }`; 409 `{ "error": "stale_suggestion" }`; 401 |
| DELETE | `/api/trips/:id/payments/:paymentId` | none | 204 | 404 `{ "error": "not_found" }` (trip not theirs or missing); 404 `{ "error": "payment_not_found" }` (payment not on this trip); 401 |

Error shape for all errors: `{ "error": "<code>" }`. The UI maps codes to the copy in States & errors. `invalid_payment` shows "Could not record this payment. Try again." The API never returns 403 for payments (same as F3.R14, F4 and F5).

The amount is sent as an integer of cents, because the server computes it. Responses use integer `amount_cents` only.

**Browser storage:** None. The session cookie is F1's.

## States & errors
**Copy below was proposed by the assistant and approved by the user as written on 2026-11-17.**

| State | What the user sees |
|---|---|
| Heading | "Settle up" |
| Under the heading | "Payments happen outside the app. Marking one as paid only records it here." |
| Subheading, suggestions | "Suggested payments" |
| Subheading, recorded | "Payments made" |
| Suggestion row | "{payer} pays {payee} {amount}" with a "Mark as paid" button |
| Recorded row | "{payer} paid {payee} {amount}" with a "Delete payment" button |
| Loading | "Loading payments…" |
| Load fails (network or server) | "Could not load payments. Try again." with a "Try again" button |
| Every balance zero | "Everyone is even. No payments are needed." (in place of suggestions) |
| No payments recorded | "No payments yet." (in place of rows in Payments made) |
| Trip has no people | "Add people to this trip to settle up." (no suggestions, no payments) |
| Mark as paid succeeds | Row moves to Payments made; "Payment recorded." is shown; Settle up and Balances refresh |
| Mark as paid fails (network or server) | "Could not record this payment. Try again." The suggestion stays. |
| Mark as paid, suggestion no longer current (`stale_suggestion`) | "These balances have changed. Refresh to see the latest suggestions." Nothing is recorded; suggestions reload |
| Delete confirmation open | Panel on that row: "Delete this payment? The balances will change as if it had not been paid." with "Cancel" and "Delete payment" |
| Delete succeeds | Row removed; "Payment deleted." Suggestions and balances refresh |
| Delete fails (network or server) | "Could not delete this payment. Try again." The row stays. |
| Payment not found (`payment_not_found`) | "This payment is no longer on this trip." The row is removed from the list. |
| Trip not found | "This trip could not be found." (F2 wording) |
| Logged out | Redirect to Log in (F1) |
| Session expired during a request | Redirect to Log in (F1) |

- **Loading:** the section shows "Loading payments…" until the first response arrives. Refreshes after a payment or expense change keep the current rows visible until the new figures arrive.
- **Validation:** the server checks the request (F6.R6). The UI sends only suggestions it has shown, so `invalid_payment` comes up only if the page is stale or altered.

## Accessibility
- The section has a visible heading "Settle up" and is reachable by keyboard in the normal tab order.
- Each "Mark as paid" and "Delete payment" control has an accessible name that includes its row's text, for example "Mark as paid: Jo pays Sam 40.00", so screen reader users can tell rows apart.
- The delete confirmation panel receives focus when it opens. "Cancel" is the first button in the panel's tab order. Escape closes the panel.
- After a successful "Mark as paid", focus moves to the "Payments made" subheading. After a successful delete, focus moves to the "Settle up" heading.
- Status messages ("Payment recorded.", "Payment deleted.", the stale-suggestion message) use a polite live region. The stale-suggestion message is also linked to the section.
- Each row is plain text. Direction is in words ("pays", "paid"), not only in position.
- All controls are reachable by keyboard. Colors meet WCAG AA contrast for text and focus outlines.
- No animation is required; if a panel animates, it respects `prefers-reduced-motion`.

## Edge cases
- **Example 1:** Sam is owed 50.00; Alex owes 10.00; Jo owes 40.00. Suggestions: "Jo pays Sam 40.00", then "Alex pays Sam 10.00" (product.md Example 1).
- **Example 3:** After "Jo pays Sam 40.00" is recorded, Sam is owed 10.00, Alex owes 10.00 and Jo is even. The only suggestion is "Alex pays Sam 10.00" (product.md Example 3).
- **Tie:** if two people owe the same largest amount, the one added to the trip first is used first (F6.R2).
- **Two tabs, same suggestion:** the first "Mark as paid" is recorded. The second finds the suggestion gone (the balances changed), so it returns `stale_suggestion`.
- **Stale amount:** a tab shows "Alex pays Sam 10.00". Another tab adds an expense that changes Alex's balance. Marking the old suggestion returns `stale_suggestion`, even though a payment from Alex to Sam would be valid. The suggestion must match exactly (F6.R6).
- **Delete then re-mark:** after deleting "Jo pays Sam 40.00", the suggestion returns as it was (F6.R4). Marking it again records a new payment with a new ID.
- **Expense deleted after a payment:** payments stay. Balances and suggestions are recalculated, and they may show a different person owing money. Example: after the dinner expense is deleted and "Jo pays Sam 40.00" is recorded, Sam owes 50.00, Alex is owed 20.00 and Jo is owed 30.00. The suggestions then are "Sam pays Jo 30.00" and "Sam pays Alex 20.00". This is allowed, because R4 still holds.
- **Person with a payment:** cannot be removed (F3.R10). After the payment is deleted, the person can be removed again (F6.R15).
- **Payer equal to payee:** rejected with `invalid_payment`. The suggestion list never produces this, so it comes up only from an altered request.
- **Large values:** a payment amount is a balance, which can be larger than one expense's maximum (R11) if many expenses exist. Integer cents cover this range (same as F5 edge cases).
- **Trip with people and no expenses:** every balance is zero. The section shows "Everyone is even. No payments are needed." and "No payments yet."
- **Trip delete:** removes its payments as well (F2.R7, F2.AC10).
- **Mark as paid with no people on the trip:** not possible; the trip has no suggestions (F6.R18).

## Acceptance criteria
- **F6.AC1** Given Example 1, when the suggested payments are calculated, then the list is "Jo pays Sam 40.00" and "Alex pays Sam 10.00", in that order. _(R6; Example 1)_
- **F6.AC2** Given the balances in Example 1 and the payment "Jo pays Sam 40.00" recorded, when the suggestions are calculated, then the only suggestion is "Alex pays Sam 10.00", and all balances add up to zero. _(R6, R5; Example 3)_
- **F6.AC3** Given two people who owe the same largest amount, when the suggestions are calculated, then the person added to the trip first is used first. _(F6.R2)_
- **F6.AC4** Given any set of balances that add up to zero, when the suggestions are applied in order, then every balance reaches zero, each suggestion is greater than zero, and there are at most one fewer than the number of people with a non-zero balance. _(R6; F6.R3; property check)_
- **F6.AC5** Given a suggestion "Alex pays Sam 10.00", when the user selects "Mark as paid", then the payment is recorded, "Payment recorded." is shown, and the payment appears under "Payments made" as "Alex paid Sam 10.00". _(F6.R5, F6.R9)_
- **F6.AC6** Given a suggestion whose payer, payee or amount no longer matches a current suggestion, when the user selects "Mark as paid", then nothing is recorded, "These balances have changed. Refresh to see the latest suggestions." is shown, and the suggestions reload. _(F6.R6, F6.R8)_
- **F6.AC7** Given two tabs showing the same suggestion, when "Mark as paid" is selected in both, then the first is recorded and the second returns the stale-suggestion message, and only one payment exists. _(F6.R6, F6.R7; checked by code review)_
- **F6.AC8** Given a payment is recorded, when the balances are shown, then the payer's balance rises by the amount and the payee's balance falls by it, and all balances still add up to zero. _(F6.R13, R4, R5)_
- **F6.AC9** Given a recorded payment, when the user selects "Delete payment" and then "Cancel", then the payment is unchanged. When they select "Delete payment" in the panel, then the payment is removed, "Payment deleted." is shown, and the suggestion returns if it still applies. _(F6.R10, F6.R11)_
- **F6.AC10** Given a payment that was already deleted in another tab, when the user confirms its deletion, then "This payment is no longer on this trip." is shown and the row is removed. _(F6.R14; `payment_not_found`)_
- **F6.AC11** Given every balance is zero, when the Settle up section is shown, then it shows "Everyone is even. No payments are needed." and no suggestions. _(F6.R19)_
- **F6.AC12** Given a trip with no people, when the Settle up section is shown, then it shows "Add people to this trip to settle up." and no suggestions or payments. _(F6.R18)_
- **F6.AC13** Given a trip that belongs to another user, or a request with no session, when any payment endpoint is called, then the response is "not found" (for another user's trip) or 401 (for no session), and nothing is changed. _(F6.R14)_
- **F6.AC14** Given the user is logged out, when they open a trip's Settle up section, then they are redirected to Log in (F1). _(F1)_
- **F6.AC15** Given a server or network failure during "Mark as paid", when it fails, then "Could not record this payment. Try again." is shown and the suggestion stays. _(States & errors)_
- **F6.AC16** Given a person who is the payer or payee of a recorded payment, when the user tries to remove them on the People section, then the person is not removed. _(F6.R15; F3.AC10)_
- **F6.AC17** Given a trip with payments, when it is deleted, then its payments are removed in the same transaction as the trip. _(F6.R14, F2.AC10; checked by code review)_
- **F6.AC18** Given an expense is added or deleted, when the change is saved, then the Settle up section shows the new suggestions without a page reload and with no message. _(F6.R4; same rule as F5.R13)_

## Dependencies
- **F1 (Registration and login):** supplies the session and the login check.
- **F2 (Trips):** supplies the trip page, the ownership check, and the trip-delete rule that removes payments (F2.AC10).
- **F3 (People):** supplies the people in the payer and payee lists. F3's "in use" check reads `payments` once this feature exists (F3.R10, F3.AC10).
- **F4 (Expenses):** supplies the expenses behind the balances. Expense changes refresh this section (F6.AC18).
- **F5 (Balances):** supplies the balances the suggestions are calculated from. F5.R1's payments term is filled in by this feature. F5 does not otherwise change.
- **Build order:** step 6, after F5 (balances). This is the last MVP feature.
- **External services:** none.

## Test plan
Unit tests only (project rules). Each test name includes its AC ID. Ownership, transaction locking, foreign keys and cascades need a database or the full app, so they are checked by code review.

| Test | AC |
|---|---|
| Suggestions: Example 1 gives "Jo pays Sam 40.00" then "Alex pays Sam 10.00" (pure function) | F6.AC1 |
| Suggestions: after the Jo-to-Sam payment is applied, only "Alex pays Sam 10.00" remains | F6.AC2 |
| Suggestions: equal largest debts are ordered by the order people were added | F6.AC3 |
| Suggestions: for generated balances that add up to zero, applying the suggestions reaches zero, every amount is above zero, and the count is at most people with a non-zero balance minus one (property check) | F6.AC4 |
| Suggestions: all-zero balances give an empty list | F6.AC11 |
| Record: a payment matching a current suggestion exactly is inserted (fake repository) | F6.AC5 |
| Record: a payment with a different amount, payer or payee than any current suggestion returns `stale_suggestion` and inserts nothing (fake repository) | F6.AC6 |
| Record: payer equal to payee, a missing ID, or an amount that is zero, negative or not an integer returns `invalid_payment` and inserts nothing | F6.AC6 |
| Record: a repository failure returns a generic failure and inserts nothing | F6.AC15 |
| Payment after recording: balances include the payment and still add up to zero (pure function) | F6.AC8 |
| Delete: Cancel path makes no repository delete call | F6.AC9 |
| Delete: confirmed deletion calls the repository once with the trip ID and payment ID | F6.AC9 |
| Delete: a payment ID not on the requested trip returns `payment_not_found` and calls no delete | F6.AC10 |
| Payment endpoints with no session: handler is not called; 401 returned | F6.AC13 |
| Fake logger: record and delete log no amounts and no session token | F6.AC8 |
| Formatting: "{payer} pays {payee} {amount}" and "{payer} paid {payee} {amount}" with two decimal places | F6.AC5 |
| Client state: `stale_suggestion` shows the stale message and reloads suggestions | F6.AC6 |
| Client state: `payment_not_found` shows its message and removes the row | F6.AC10 |
| Client state: no people shows the trip-has-no-people message; zero balances show "Everyone is even. No payments are needed." | F6.AC11, F6.AC12 |

**Code review** (needs a real database or the full app):
- F6.AC7 — the check and insert run in one transaction that locks the trip row (two-tab race).
- F6.AC13 — the trip ownership filter runs on every payment query (two users).
- F6.AC16 — removing a person who is a payer or payee is refused, using real rows (F3.AC10).
- F6.AC17 — trip delete removes payments before people, under the restrict foreign keys (F2.AC10).
- The `payments.payer_id` and `payments.payee_id` foreign keys restrict deletes of people (F3.R10). The "payer not equal to payee" check and the same-trip rule for payer and payee exist in the schema or in the transaction.
- Indexes on `payments.trip_id`, `payments.payer_id` and `payments.payee_id` exist.
- F6.AC18 — the Settle up section refreshes after an expense change in the browser.

## Open questions
None. All questions are answered in the Decisions log.

## Decisions log
- 2026-11-17: Copy for the Settle up section (heading, subheadings, rows, buttons, empty, error, stale-suggestion and confirmation messages): approved as proposed by the user.
- 2026-11-17: Settle-up wording in product.md: fewest payments? → Keep R6 as written. The Overview and Goals in product.md are reworded so they do not promise the true minimum. Use "a short list of suggested payments (R6)".
- 2026-11-17: Stale suggestion when marking as paid? → Reject. The server recalculates the current suggestions and records the payment only if it matches one exactly (payer, payee, amount). Otherwise it returns "These balances have changed. Refresh to see the latest suggestions."
- 2026-11-17: Confirmation before deleting a payment? → Yes, with the sentence "Delete this payment? The balances will change as if it had not been paid." and buttons "Cancel" and "Delete payment".
- 2026-11-17: Where the section sits? → Below Balances on the trip page (default accepted).
- 2026-11-17: Tie order for equal amounts? → The person added to the trip first (default accepted).
- 2026-11-17: Order of the Payments made list? → Newest first, the same as expenses (default accepted).
- 2026-11-17: Suggestions stored or calculated? → Calculated each time; not stored (follows product.md Example 3).
- 2026-11-17: Spec approved by the user. Status set to Approved.

## product.md changes applied
- Overview: "and the fewest payments needed to settle up" → "and a short list of suggested payments (R6) to settle up".
- Goals: "Settling up needs as few payments as possible." → "Settling up takes a short list of suggested payments (R6)."
- No business rule changed. R6 is kept as written.
