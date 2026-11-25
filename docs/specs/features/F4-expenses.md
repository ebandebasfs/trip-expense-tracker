# F4 — Expenses

_Status: Approved · Last updated: 2026-11-17 · Source: product.md — MVP scope (F4), Roles, Assumptions (Equal splits, No editing, Amounts are whole cents), Key terms (Expense), Business rules R1–R3, R7, Worked examples 1–2, Ownership rule_

## Summary
A logged-in user records what was paid on a trip: a description, an amount, who paid, and who shares the cost. Everyone on the trip shares it by default, and the user can untick people. The app splits the amount equally to the cent, shows the expenses newest first with each person's share, and lets the user delete an expense after confirming. Expenses cannot be edited; a mistake is fixed by deleting and adding again. These expenses feed the balances in F5 and the settle-up figures in F6.

## User stories
- As a user, I want to record an expense with what it was for, how much it cost and who paid, so that the trip's spending is written down.
- As a user, I want everyone on the trip to be selected by default, so that most expenses take one step.
- As a user, I want to untick people who did not share an expense, so that only they pay their part.
- As a user, I want to see each person's share of an expense, so that I can check the split.
- As a user, I want to delete an expense I entered by mistake, after confirming, so that I do not remove one by accident.

## Scope
**In:**
- Add an expense to a trip: description, amount, payer, and the people who share it.
- Equal split, rounded down to the cent, with leftover cents given one each to participants in the order they were added to the trip (R3).
- List the trip's expenses, newest first, with each person's share.
- Delete an expense after a confirmation step.
- Ownership check on every expense request, through the trip (same rules as F2 and F3).
- The Expenses section on the trip page (`/trips/:id`), which F2 and F3 left out until F4 arrives.

**Out:**
- Editing an expense, including its amount, payer, participants or description (product.md Assumptions: No editing).
- Uneven splits, percentage splits, or any split other than equal (product.md Assumptions: Equal splits only).
- Expense dates. Product.md defines four inputs for an expense, and a date is not one of them. Expenses are ordered by when they were added.
- Currency or conversion (product.md Assumptions: One currency).
- Balances and settle-up figures. Those are F5 and F6.
- Attachments, categories, notes, or receipts. Not in product.md.
- Choosing a person who is not on the trip, and adding a person from inside the expense form. People are added with F3.

## User flow & screens
1. The user opens a trip (`/trips/:id`). The Expenses section shows the add form above the expense list.
2. The form has the fields "Description", "Amount" and "Paid by", and a "Shared by" group with one checkbox per person on the trip. All checkboxes are checked by default.
3. The user fills in the form and selects "Add expense". On success, the new expense appears at the top of the list, the form is cleared, the checkboxes return to all checked, and "Expense added." is announced.
4. If validation fails, the message appears under the relevant field (or under the "Shared by" group). Typed values are kept.
5. Each row shows the description, amount, payer, the share line, and a "Delete" button.
6. The user selects "Delete". A confirmation panel opens on that row: `Delete "{description}"? This cannot be undone.` with "Cancel" and "Delete expense". Cancel closes the panel and changes nothing. "Delete expense" removes the expense and shows "Expense deleted."
7. If the trip has no people, the form is replaced by a message and no expense can be added. The list still shows any expenses that exist.

Screens: none in `docs/design` yet. The trip page layout is the one F2 and F3 define.

## Requirements
- **F4.R1** An expense has one description, one amount, one payer, and one or more participants. All of them belong to the same trip (product.md R2).
- **F4.R2** The description is required. Leading and trailing spaces are trimmed. After trimming it is 1–100 characters. Two expenses may have the same description (no uniqueness rule). _Derived:_ the trimming and non-empty rule follow F3.R2; the 100-character limit is from the Decisions log.
- **F4.R3** The amount is entered as text in the form `digits`, `digits.digits`, `.digits` (for example `.5`, read as 0.50), or `digits.`, with at most two digits after the point. Thousands separators such as `1,000.00` are not accepted. It must be greater than zero and no more than 1,000,000.00. It is stored as a whole number of cents, never as a floating-point number (product.md Assumptions).
- **F4.R4** The payer is exactly one person on the trip (product.md R2). The payer does not have to be a participant.
- **F4.R5** Participants are one or more people on the trip. By default all people on the trip are selected. The user can untick any of them, but at least one must stay selected (product.md R2).
- **F4.R6** Shares: each share is the amount in cents divided by the number of participants, rounded down. The leftover cents go one each to participants in the order they were added to the trip (product.md R3). The shares of an expense always add up to exactly its amount.
- **F4.R7** The expense list for a trip shows all its expenses, newest added first. Each row shows the description, the amount, the payer, and each participant's share.
- **F4.R8** Deleting an expense requires the confirmation step in F4.R9, then removes the expense and its shares. It cannot be undone.
- **F4.R9** The delete confirmation panel shows the description in the sentence and offers "Cancel" and "Delete expense". Cancel makes no change.
- **F4.R10** A trip with no people cannot have expenses. The add form is replaced by a message. The API rejects an add to such a trip (see Data & contract).
- **F4.R11** Every expense request checks that the trip belongs to the logged-in user. A trip that is not theirs, or does not exist, returns "not found", the same as F2.R9. An expense or participant on another trip is treated as not found (product.md Ownership rule).
- **F4.R12** A person who is in an expense cannot be removed (F3.R10, product.md R7). Deleting the last expense that includes a person makes that person removable again (see F3, which checks this).
- **F4.R13** Expenses are never edited. There is no route or screen that changes an expense after it is added (product.md Assumptions: No editing).

## Data & contract
**Table `expenses`** (new):

| Column | Type | Rules |
|---|---|---|
| `id` | unique ID | Primary key |
| `trip_id` | reference to `trips.id` | Required. Deleting the trip deletes its expenses (F2.R7) |
| `description` | text | Required. Trimmed, 1–100 characters (F4.R2). Stored as typed after trimming |
| `amount_cents` | integer | Required. Greater than zero and no more than 100000000 (F4.R3) |
| `payer_id` | reference to `people.id` | Required. Must be a person on the same trip (F4.R4). Restrict on delete: a person with an expense cannot be deleted (F3.R10) |
| `created_at` | timestamp | Set on insert. Sort key for the list, newest first (F4.R7). Ties broken by `id` |

**Table `expense_shares`** (new): one row per participant of an expense.

| Column | Type | Rules |
|---|---|---|
| `expense_id` | reference to `expenses.id` | Required. Deleting the expense deletes its shares |
| `person_id` | reference to `people.id` | Required. Restrict on delete (F3.R10). Must be on the same trip as the expense |
| `share_cents` | integer | Required. Zero or more. The shares of one expense sum to `amount_cents` (F4.R6) |

Primary key `(expense_id, person_id)`. Index on `expenses.trip_id`. Index on `expense_shares.person_id`, so the "in use" check for F3 is fast.

The shares are stored, not recalculated, so that F5 balances read the same numbers the user saw. Because people cannot be removed while in an expense (F4.R12), the participant order used for leftover cents does not change after the expense is saved.

**API** (paths are the proposed shape; the plan confirms the framework's routing style):

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/trips/:id/expenses` | none | 200 `{ "expenses": [{ "id", "description", "amount_cents", "payer": { "id", "name" }, "shares": [{ "person_id", "name", "share_cents" }] }] }`, newest added first | 404 `{ "error": "not_found" }`; 401 |
| POST | `/api/trips/:id/expenses` | `{ "description": string, "amount": string, "payer_id": string, "participant_ids": string[] }` | 201 `{ "expense": { …same shape as GET… } }` | 400 `{ "error": "description_required" \| "description_too_long" \| "amount_required" \| "amount_invalid" \| "amount_not_positive" \| "amount_too_large" \| "amount_too_many_decimals" \| "payer_required" \| "payer_not_on_trip" \| "participants_required" \| "participant_not_on_trip" }`; 404 `not_found`; 409 `{ "error": "no_people" }`; 401 |
| DELETE | `/api/trips/:id/expenses/:expenseId` | none | 204 | 404 `{ "error": "not_found" }`; 401 |

Error shape for all errors: `{ "error": "<code>" }`. The UI maps codes to the copy in States & errors. Codes without their own copy (`payer_not_on_trip`, `participant_not_on_trip`) show "Could not add this expense. Try again." The form only offers people from the trip, so these come up only if the page is stale. The API never returns 403 for expenses (same as F3.R14).

The amount is sent as a string so the server can check its exact form. Responses use integer `amount_cents` and `share_cents` only.

**Browser storage:** None. The session cookie is F1's.

## States & errors
**Copy below was approved by the user as written on 2026-11-17.**

| State | What the user sees |
|---|---|
| Loading expenses | "Loading expenses…" |
| Empty list | "No expenses yet. Add the first one above." |
| Trip has no people | "Add people to this trip before adding an expense." The form is replaced by this line. |
| Description empty or only spaces | Under the field: "Enter a description." |
| Description over 100 characters | Under the field: "Descriptions can be up to 100 characters." |
| Amount empty | Under the field: "Enter an amount." |
| Amount not a number | Under the field: "Enter an amount like 12.50." |
| Amount zero or negative | Under the field: "The amount must be more than zero." |
| Amount over 1,000,000.00 | Under the field: "The amount can be up to 1,000,000.00." |
| Amount with more than two decimals | Under the field: "Use at most two decimal places, like 12.50." |
| Payer not chosen | Under the "Paid by" field: "Choose who paid." |
| No one selected to share | Under the "Shared by" group: "Choose at least one person to share this expense." |
| Add succeeds | New row at the top; form cleared; checkboxes reset to all checked; "Expense added." |
| Add fails (network or server) | "Could not add this expense. Try again." The typed values are kept. |
| Delete confirmation open | Panel on that row: `Delete "{description}"? This cannot be undone.` with "Cancel" and "Delete expense" |
| Delete succeeds | Row removed; "Expense deleted." |
| Delete fails (network or server) | "Could not delete this expense. Try again." The row stays. |
| Expense not found (already deleted, or not on this trip) | "This expense is no longer on this trip." The row is removed from the list. |
| Trip not found | "This trip could not be found." (F2) |
| Logged out | Redirect to Log in (F1) |
| Session expired during a request | Redirect to Log in (F1) |

Share lines use the format `Shares: {name} {amount}, {name} {amount}` with two decimal places, for example "Shares: Sam 40.00, Alex 40.00, Jo 40.00". Each row's summary reads "Paid by {payer} · shared by {n} people", with "1 person" when n is 1.

## Accessibility
- Each field has a visible label: "Description", "Amount", "Paid by". The "Shared by" checkboxes sit in a group with the visible label "Shared by".
- Error messages are linked to their field or group and announced when they appear.
- Each Delete control has an accessible name that includes the expense's description, e.g. "Delete lunch at harbour", so screen reader users can tell rows apart.
- The delete confirmation panel receives focus when it opens. "Cancel" is the first button in the panel's tab order. Escape closes the panel.
- After a successful delete, focus moves to the Expenses heading, or to the empty-state message if the list is now empty.
- Status messages ("Expense added.", "Expense deleted.") use a polite live region.
- All controls are reachable by keyboard. Colors meet WCAG AA contrast for text and focus outlines.
- No animation is required; if a panel animates, it respects `prefers-reduced-motion`.

## Edge cases
- **Rounding:** 10.00 shared by three people gives 3.34, 3.33, 3.33 (product.md Example 2). The first participant in the order added gets the extra cent.
- **Cent smaller than participants:** 0.01 shared by three gives 0.01 to the first person added and 0.00 to the others. Shares still add up to 0.01.
- **Payer not sharing:** Sam pays 90.00 for taxis shared by Alex and Jo. Alex and Jo each have a share of 45.00. Sam has no share. This is allowed (F4.R4).
- **Single participant:** the full amount is one share.
- **Maximum amount:** 1,000,000.00 is accepted. 1,000,000.01 is rejected.
- **Whole-cent input:** "12", "12.5" and ".5" are accepted and read as 12.00, 12.50 and 0.50. "1,000.00" is rejected with "Enter an amount like 12.50." (the not-a-number message).
- **Duplicate descriptions:** allowed. Two "Taxi" expenses are two expenses.
- **Person in an expense:** cannot be removed (F3). After the expense is deleted, the person can be removed again.
- **Two tabs:** a delete in one tab and an add in another are both saved. Deleting an expense already deleted in another tab shows "This expense is no longer on this trip."
- **Trip with people removed to zero:** only possible if no expenses exist (F3.R10). The add form then shows "Add people to this trip before adding an expense."
- **Trip delete:** removes its expenses and shares as well (F2.R7, F3 Data & contract).

## Acceptance criteria
- **F4.AC1** Given a trip with people, when the user enters a description, an amount such as "12.50", a payer and at least one participant, and selects "Add expense", then the expense is saved, appears at the top of the list, the form is cleared, and "Expense added." is shown.
- **F4.AC2** Given a description that is empty, only spaces, or over 100 characters, when the user adds it, then the matching message from States & errors is shown and nothing is saved. Leading and trailing spaces are removed before saving.
- **F4.AC3** Given an amount that is empty, not a number, zero or negative, over 1,000,000.00, or has more than two decimals, when the user adds it, then the matching message is shown and nothing is saved. A valid amount is stored as whole cents.
- **F4.AC4** Given no payer is chosen, when the user adds the expense, then "Choose who paid." is shown and nothing is saved.
- **F4.AC5** Given a new expense form, when it opens, then every person on the trip is checked. Given no one is checked, when the user adds the expense, then "Choose at least one person to share this expense." is shown and nothing is saved.
- **F4.AC6** Given an expense with participants, when it is saved, then each share is the amount divided equally and rounded down to the cent, leftover cents go one each to participants in the order they were added to the trip, and the shares add up to the amount exactly. Example 2 gives 3.34, 3.33 and 3.33.
- **F4.AC7** Given a payer who is not a participant, when the expense is saved, then it is accepted, and the payer has no share.
- **F4.AC8** Given a trip with no people, when the user opens its Expenses section, then the add form is replaced by "Add people to this trip before adding an expense." and an add request is refused with `no_people`.
- **F4.AC9** Given a trip with expenses, when the user views the list, then every expense is shown newest added first, with description, amount, payer and share line. Given no expenses, the list shows "No expenses yet. Add the first one above."
- **F4.AC10** Given the user selects "Delete" on an expense, when they select "Cancel", then the expense is unchanged. When they select "Delete expense", then the expense and its shares are removed and "Expense deleted." is shown.
- **F4.AC11** Given an expense that was already deleted in another tab, when the user confirms its deletion, then "This expense is no longer on this trip." is shown and the row is removed.
- **F4.AC12** Given a trip that belongs to another user, or a request with no session, when any expense endpoint is called, then the response is "not found" (for another user's trip) or 401 (for no session), and nothing is changed.
- **F4.AC13** Given the user is logged out, when they open a trip's expenses, then they are redirected to Log in (F1).
- **F4.AC14** Given a server or network failure during add, when it fails, then "Could not add this expense. Try again." is shown and the typed values are kept.
- **F4.AC15** Given a person who appears only in a deleted expense, when the user removes that person on the People section, then the removal is allowed (F3.AC9 with F4 in place).
- **F4.AC16** The expense API and UI never use floating-point numbers for amounts. Responses carry `amount_cents` and `share_cents` as integers.

## Dependencies
- **Build order:** step 4, after F3 (people). F5 (balances) and F6 (settle up) depend on this feature.
- **F1 (Registration and login):** supplies the session and the login check.
- **F2 (Trips):** supplies the trip page this feature extends, the trip ownership check, and the trip-delete rule that removes expenses.
- **F3 (People):** supplies the people in the "Shared by" group and the payer list. F3's "in use" check reads `expenses` and `expense_shares` once this feature exists (F3.R10).
- **F5 (Balances):** reads the shares and payers saved here.
- **External services:** none.

## Test plan
Unit tests only (project rules). Each test name includes its AC ID.

| Test | AC |
|---|---|
| Description: trims spaces; empty, spaces-only and 101 characters rejected; 100 accepted | F4.AC2 |
| Amount parsing: "12.50", "12", "12.5", ".5" accepted as cents (1250, 1200, 1250, 50); "", "abc", "1,000.00", "0", "-1", "1000000.01", "12.345" each rejected with its own code; "1000000.00" accepted | F4.AC3 |
| Payer: missing rejected; payer not on the trip rejected (fake repository) | F4.AC4, F4.AC1 |
| Participants: none selected rejected; participant not on the trip rejected (fake repository) | F4.AC5, F4.AC1 |
| Split: 10.00 among three participants returns 3.34, 3.33, 3.33 | F4.AC6 |
| Split: 0.01 among three returns 0.01, 0.00, 0.00 | F4.AC6 |
| Split: shares always sum to the amount, for generated amounts and participant counts (property check, 1 to 20 people) | F4.AC6 |
| Split: leftover cents follow the order the people were added, not the order of the selection | F4.AC6 |
| Payer not a participant: expense accepted and payer has no share (fake repository) | F4.AC7 |
| Add: a new expense is saved with amount in cents and the payer ID and participant IDs (fake repository) | F4.AC1, F4.AC16 |
| Add to a trip with no people: returns `no_people` and calls no save (fake repository) | F4.AC8 |
| List: returns the trip's expenses newest added first, with payer and shares (fake repository) | F4.AC9 |
| Delete: Cancel path makes no repository delete call | F4.AC10 |
| Delete: confirmed deletion calls the repository once with the trip ID and expense ID | F4.AC10 |
| Delete: an expense ID not on the requested trip returns not_found and calls no delete | F4.AC11, F4.AC12 |
| Add failure from the repository returns a generic failure and saves nothing | F4.AC14 |
| Expense endpoints with no session: handler is not called; 401 returned | F4.AC12 |
| Fake logger: add, list and delete log no amounts and no session token | F4.AC16 |

**Code review** (needs a real database or the full app; not unit-testable):
- F4.AC12 — the trip ownership filter runs on every expense query in the real app (end-to-end check with two users).
- F4.AC15 — removal of a person becomes allowed after their last expense is deleted (real database with F3's check).
- F4.AC16 — the `amount_cents` and `share_cents` columns are integers in the real schema; no float column exists.
- The `expenses.payer_id` and `expense_shares.person_id` foreign keys restrict deletes of people (F3.R10).
- The unique key `(expense_id, person_id)` and the indexes on `expenses.trip_id` and `expense_shares.person_id` exist.
- Trip delete removes expenses, shares, payments and people in an order that works with the restrict foreign keys (F2.AC10).

## Open questions
- [x] Should the amount accept a thousands separator, such as "1,000.00"? → No. Rejected with "Enter an amount like 12.50." (F4.R3).
- [x] Should a leading decimal point, such as ".5", be accepted? → Yes, read as 0.50 (F4.R3).
- [x] Is the "Paid by" field left empty or pre-filled? → Left empty; the user must choose. If not chosen, "Choose who paid." is shown (F4.R4).
- [x] Should the API's error codes have their own copy? → No. The UI shows the approved messages for each code; codes with no specific message use "Could not add this expense. Try again."

## Decisions log
- 2026-11-17: Description length limit? → 100 characters.
- 2026-11-17: Largest amount allowed? → 1,000,000.00.
- 2026-11-17: Expense list order? → Newest first.
- 2026-11-17: Confirm before deleting an expense? → Yes, with the "cannot be undone" sentence.
- 2026-11-17: Amount with more than two decimals? → Show an error; do not round.
- 2026-11-17: Show each person's share in the list? → Yes.
- 2026-11-17: Limit on expenses per trip? → No limit.
- 2026-11-17: Labels and messages approved as drafted in the proposal (the States & errors table and the labels in User flow & screens).
- 2026-11-17: Spec saved as Draft.
- 2026-11-17: Thousands separator in the amount ("1,000.00")? → No; rejected with the invalid-amount message.
- 2026-11-17: Leading decimal point (".5")? → Yes; read as 0.50.
- 2026-11-17: "Paid by" pre-filled? → No; left empty, and "Choose who paid." is shown if not chosen.
- 2026-11-17: Separate copy for API error codes? → No; the UI uses the approved messages.
- 2026-11-17: product.md R10 (description length), R11 (maximum amount) and the no-date / added-order assumption? → Yes, all three applied.
- 2026-11-17: Spec approved by the user. Status set to Approved.

## product.md changes applied
- Business rules R10 (description 1–100 characters) and R11 (amount no more than 1,000,000.00) added.
- Assumption added: expenses have no date and are listed by the order they were added.
