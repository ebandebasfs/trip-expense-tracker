# F3 — People

_Status: Approved · Last updated: 2026-11-17 · Source: product.md — MVP scope (F3), Roles, Assumptions (No editing), Key terms (Person), Business rules R3, R7, Ownership rule_

## Summary
A logged-in user adds people to one of their trips by name, sees them listed in the order they were added, and removes a person who was added by mistake. A person who appears in any expense or payment cannot be removed, so the balances and settle-up figures in F5 and F6 always match the recorded history. People have names only; they do not have accounts.

## User stories
- As a user, I want to add a person to a trip by name, so that I can split expenses with them.
- As a user, I want to remove a person I added by mistake, so that the trip only lists the people who are really on it.
- As a user, I want to be told why I cannot remove a person, so that I know what to change first.

## Scope
**In:**
- Add a person to a trip by name.
- List the people on a trip, in the order they were added.
- Remove a person after a confirmation step, if the person is in no expense and no payment.
- Ownership check on every people request, through the trip (same rules as F2).
- The People section on the trip page (`/trips/:id`), which F2 left as name-only until F3–F5 arrive.

**Out:**
- Renaming a person. Names are not edited (product.md Assumptions: No editing). A mistake is fixed by removing and adding again, which is allowed only while the person is in no expense or payment.
- Accounts for people, invitations, or letting people log in (product.md Roles: people are names only).
- Choosing who is in an expense. That is F4 (participants default to everyone on the trip).
- Removing a person who is in an expense or payment. This is blocked by R7 and is not a feature. To remove that person, the user first deletes those expenses and payments (F4, F6).
- Uneven splits, editing, or any import of people (product.md "After the core").

## User flow & screens
Working screen names (no `docs/design` yet; these match F1 and F2 naming).

1. **Trip page** (`/trips/:id`). Below the trip name, a **People** section, top to bottom:
   - An **Add person** form: a "Person name" field and an "Add person" button.
   - The list of people, oldest added first. Each row shows the name and a Remove control.
2. **Add person.** User types a name and submits.
   - Success → the person is added at the bottom of the list, the field is cleared, and "Person added." is shown.
   - Validation error or duplicate → message shown under the field; the typed name is kept.
3. **No people yet** → empty state in place of the list.
4. **Remove person.** User clicks Remove on a row.
   - A confirmation panel opens on that row: "Remove {name} from this trip?" with buttons "Cancel" and "Remove person".
   - "Cancel" → the panel closes; nothing changes.
   - Confirm → the person is removed from the list and "Person removed." is shown.
   - The person is in an expense or payment → the panel does not remove them; the message "This person is in an expense or payment, so they can't be removed." is shown on that row.
5. **Logged-out visitor** opens `/trips/:id` → redirected to **Log in** (F1 flow).
6. **Trip not found** (missing, or not theirs) → "This trip could not be found." (F2 Trip page).

## Requirements
- **F3.R1** A person belongs to one trip. A person has a name only; there is no account, email or other detail. (Stated: product.md Key terms "Person", Roles.)
- **F3.R2** A person's name is trimmed of leading and trailing spaces before it is checked and saved. (Inferable: follows F2.R1, the approved trimming rule for names.)
- **F3.R3** A person name must have at least one character after trimming, and at most 100 characters, counted in characters. Any characters are allowed. (Chosen: 100 characters, matching F2.R2.)
- **F3.R4** Person names are unique within a trip. Comparison ignores letter case, so "Sam" and "sam" are the same name on one trip. The name is stored as typed (after trimming). The app checks this, and the database also enforces it. (Stated: product.md Key terms, "unique within that trip". Chosen: case-insensitive.)
- **F3.R5** The same name may be used on different trips. (Inferable from F3.R4: uniqueness is within a trip.)
- **F3.R6** A trip can have any number of people. (Chosen: no limit.)
- **F3.R7** Adding a person puts them at the end of the trip's people. The order they were added is kept. (Stated: product.md R3 relies on "the order they were added to the trip". Chosen: the list shows that order.)
- **F3.R8** The people list shows each person's name only, oldest added first. (Chosen.)
- **F3.R9** Removing a person requires the user to confirm in the panel. (Chosen: confirm first, same pattern as F2.R7.)
- **F3.R10** A person cannot be removed while they are in any expense (as payer or as a participant) or in any payment (as payer or as payee). (Stated: product.md R7; the Done-when in MVP scope.)
- **F3.R11** The "in use" check and the removal happen in one transaction. Expense and payment rows that reference a person cannot be deleted by a removal, even if the check is bypassed. (Inferable from R7: the rule must hold under two tabs or concurrent requests.)
- **F3.R12** Once a person is removed, their name can be used again by a new person on the same trip. (Inferable from F3.R4: uniqueness covers only people who are on the trip.)
- **F3.R13** Person names are never edited. No endpoint or screen changes a name after the person is added. (Stated: product.md Assumptions: No editing.)
- **F3.R14** Every people request requires a logged-in session and checks that the trip belongs to the session's user before reading or changing anything. A trip that is missing or belongs to another user, and a person ID that is not on the requested trip, both return the same "not found" response. (Stated: product.md Ownership rule. Pattern: F2.R8–R9.)

## Data & contract
**Table `people`** (new):

| Column | Type | Rules |
|---|---|---|
| `id` | unique ID | Primary key |
| `trip_id` | reference to `trips.id` | Required. Deleting the trip deletes its people (F2.R7) |
| `name` | text | Required. Trimmed, 1–100 characters (F3.R2–R3). Stored as typed |
| `created_at` | timestamp | Set on insert. Sort key for the list (F3.R7–R8). Ties broken by `id` |

Unique constraint on `trip_id` plus the case-insensitive form of `name` (F3.R4). Index on `trip_id`.

**Foreign keys from `expenses` and `payments` to `people`** (tables built with F4 and F6): these must not cascade on person delete. A person with a reference cannot be deleted (F3.R10–R11). Deleting a trip removes expenses and payments as well as people, so the trip delete must run in an order that works under these rules. The plan checks this order.

**API** (paths are the proposed shape; the plan confirms the framework's routing style):

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/trips/:id/people` | none | 200 `{ "people": [{ "id", "name" }] }`, oldest added first | 404 `{ "error": "not_found" }`; 401 |
| POST | `/api/trips/:id/people` | `{ "name": string }` | 201 `{ "person": { "id", "name" } }` | 400 `{ "error": "name_required" \| "name_too_long" }`; 404 `not_found`; 409 `{ "error": "name_taken" }`; 401 |
| DELETE | `/api/trips/:id/people/:personId` | none | 204 | 404 `{ "error": "not_found" }`; 409 `{ "error": "person_in_use" }`; 401 |

Error shape for all errors: `{ "error": "<code>" }`. The UI maps codes to copy in States & errors. The API never returns 403 for people (F3.R14), matching F2.R9.

**Browser storage:** None. The session cookie is F1's.

## States & errors
**Copy below was approved by the user as written on 2026-11-17.**

| State | What the user sees |
|---|---|
| Loading people | "Loading people…" |
| Empty list | "No people yet. Add the people on this trip." |
| Name empty or only spaces | Under the field: "Enter a name." |
| Name over 100 characters | Under the field: "Names can be up to 100 characters." |
| Name already on this trip (any letter case) | Under the field: "Someone on this trip already has that name." The typed name is kept. |
| Add succeeds | New row at the bottom; field cleared; "Person added." |
| Add fails (network or server) | "Could not add this person. Try again." The typed name is kept. |
| Remove confirmation open | Panel on that row: "Remove {name} from this trip?" with buttons "Cancel" and "Remove person" |
| Remove blocked (person in an expense or payment) | On that row: "This person is in an expense or payment, so they can't be removed." The row stays. |
| Remove succeeds | Row removed; "Person removed." |
| Remove fails (network or server) | "Could not remove this person. Try again." The row stays. |
| Person not found (already removed, or not on this trip) | "This person is no longer on this trip." The row is removed from the list. |
| Trip not found | "This trip could not be found." (F2) |
| Logged out | Redirect to Log in (F1) |
| Session expired during a request | Redirect to Log in (F1) |

## Accessibility
- The name field has a visible label "Person name". Error messages are linked to the field and announced when they appear.
- Each Remove control has an accessible name that includes the person's name, e.g. "Remove Sam", so screen reader users can tell rows apart.
- The confirmation panel receives focus when it opens. "Cancel" is the first button in the panel's tab order. Escape closes the panel.
- After a successful removal, focus moves to the People heading, or to the empty-state message if the list is now empty.
- Status messages ("Person added", "Person removed") use a polite live region. Blocked-removal messages use the same region.
- All controls are reachable by keyboard. Colors meet WCAG AA contrast for text and focus outlines.
- No animation is required; if a panel animates, it respects `prefers-reduced-motion`.

## Edge cases
- Name is only spaces → rejected (F3.R3). 100 characters after trimming → accepted; 101 → rejected.
- "Sam" exists, user adds "sam" or " SAM " → rejected as a duplicate (F3.R4). The stored name stays "Sam".
- "Sam" exists on trip A; user adds "Sam" to trip B → accepted (F3.R5).
- "Sam" is removed; user adds "Sam" again → accepted (F3.R12). The new person goes to the bottom of the list.
- Two tabs add "Sam" to the same trip at once → one succeeds; the other gets the duplicate message (the database constraint catches the race).
- Two tabs: remove Sam in one, then remove Sam again in the other → second request returns 404; the row is removed and the not-found message is shown.
- Person is in an expense as payer only, or as participant only → cannot be removed (F3.R10).
- Person is in a payment as payee only → cannot be removed (F3.R10).
- Person is removed while an expense that includes them is being saved (F4 race) → the database refuses the removal, or the expense save fails; no expense ends up referencing a removed person (F3.R11).
- Person ID from another trip, or from another user's trip → 404, nothing revealed (F3.R14).
- Malformed person ID in the URL → 404, not a server error.
- Trip is deleted → its people are removed with it (F2.R7).
- User's account is deleted (F1) → trips and their people are gone; requests return 401.
- Trip with zero people → the people list shows the empty state. No expense can be added until F4 allows it (F4 requires at least one participant, product.md R2).

## Acceptance criteria
- **F3.AC1** Given a logged-in user with a trip, when they add "Sam", then "Sam" is saved on that trip and appears at the bottom of the people list. _(R1, R7, R8)_
- **F3.AC2** Given a name with leading and trailing spaces, when it is saved, then the stored name has no leading or trailing spaces. _(R2)_
- **F3.AC3** Given a name that is empty or only spaces, when the user submits, then no person is saved and "Enter a name." is shown. _(R3)_
- **F3.AC4** Given a name of 101 characters, when the user submits, then no person is saved and "Names can be up to 100 characters." is shown; a name of exactly 100 characters is saved. _(R3)_
- **F3.AC5** Given a trip with "Sam", when the user adds "sam" or " SAM " to the same trip, then no person is saved, "Someone on this trip already has that name." is shown, and the stored name remains "Sam". _(R4)_
- **F3.AC6** Given "Sam" on trip A, when the user adds "Sam" to trip B, then both trips list a Sam. _(R5)_
- **F3.AC7** Given a person in no expense and no payment, when the user clicks Remove and then Cancel, then the person is still listed. _(R9)_
- **F3.AC8** Given a person in no expense and no payment, when the user clicks Remove and then confirms, then the person is removed from the list and "Person removed." is shown. _(R9)_
- **F3.AC9** Given a person who is the payer or a participant of an expense, when the user tries to remove them, then the person is not removed and "This person is in an expense or payment, so they can't be removed." is shown. _(R10; real data checked by code review once F4 exists)_
- **F3.AC10** Given a person who is the payer or payee of a payment, when the user tries to remove them, then the person is not removed. _(R10; real data checked by code review once F6 exists)_
- **F3.AC11** Given a trip with several people added in order, when the user opens the people list, then the names appear oldest added first, each row showing the name only. _(R7, R8)_
- **F3.AC12** Given a person who was removed, when the user adds a person with the same name, then the add succeeds. _(R12)_
- **F3.AC13** Given any person, when a request tries to change the name, then no endpoint or screen changes it. _(R13; checked by code review)_
- **F3.AC14** Given user A's trip, when user B lists, adds to, or removes a person on it, then the response is 404 `not_found` and nothing changes. _(R14)_
- **F3.AC15** Given a person ID that belongs to a different trip of the same user, when the user removes that ID through another trip's URL, then the response is 404 `not_found` and the person is unchanged. _(R14)_
- **F3.AC16** Given a logged-out visitor, when they call any `/api/trips/:id/people` endpoint, then the response is 401 and no person data is returned. _(R14)_
- **F3.AC17** Given a person in an expense, when a removal request runs at the same time as the expense save, then the person is either removed before the expense is saved (and the expense is refused) or kept (and the removal is refused); the expense never references a removed person. _(R11; checked by code review)_
- **F3.AC18** Given a trip-related request, when it runs, then no person name is logged at info level or above and no session token appears in any log line. _(project logging rules; same as F2.AC15)_

## Dependencies
- **Build order:** step 3, after F2 (trips) and F1 (login). F4 (expenses) and F6 (settle up) depend on this feature.
- **F1 (Registration and login):** supplies the session and the login check (F1.R10).
- **F2 (Trips):** supplies the trip page this feature extends, the trip ownership check, and the trip-delete rule that removes people (F2.R7, F2.AC10).
- **F4 (Expenses):** creates the expense rows that block removal (F3.R10). Until F4 exists, the "in use" branch is tested with a fake, and the real check is verified once F4 lands.
- **F6 (Settle up):** creates the payment rows that block removal (F3.R10). Same as F4 for the real check.
- **External services:** none.

## Test plan
Unit tests only (project rules). Each test name includes its AC ID.

| Test | AC |
|---|---|
| Name normalization: trims spaces before save | F3.AC2 |
| Name validation: empty and spaces-only rejected; 100 accepted; 101 rejected; length counts characters | F3.AC3, F3.AC4 |
| Duplicate check with a fake repository: "sam" and " SAM " rejected when "Sam" exists; stored name unchanged | F3.AC5 |
| Add with a fake repository: same name on another trip is allowed (repository called with that trip's ID only) | F3.AC6 |
| Add with a fake repository: new person is saved at the end of the list | F3.AC1 |
| List with a fake repository: returns the trip's people, oldest added first, name only | F3.AC11 |
| Remove: Cancel path makes no repository delete call | F3.AC7 |
| Remove: confirmed removal calls the repository once with the trip ID and person ID | F3.AC8 |
| Remove with a fake "in use" check returning true: no delete call; blocked message returned | F3.AC9, F3.AC10 |
| Add after removal: a name freed by removal is accepted (fake repository has no current person with that name) | F3.AC12 |
| Name update: no route or handler exists that changes a person's name | F3.AC13 |
| Get, add and remove with a fake repository: other user's trip ID returns not_found and calls no change | F3.AC14 |
| Person ID not on the requested trip returns not_found and calls no delete | F3.AC15 |
| People endpoints with no session: handler is not called; 401 returned | F3.AC16 |
| Fake logger: add, list and remove log no person name and no session token | F3.AC18 |

**Code review** (needs a real database or the full app; not unit-testable):
- F3.AC9 and F3.AC10 with real expense and payment rows (once F4 and F6 exist).
- F3.AC13 — no route changes a name in the real app.
- F3.AC14 and F3.AC15 — ownership filter in the real people queries (end-to-end check).
- F3.AC16 — real 401 from the server, not just the unit check.
- F3.AC17 — the in-use check and removal share one transaction; foreign keys from expenses and payments are not cascading.
- Unique constraint on `people (trip_id, lower(name))` exists; index on `people.trip_id` exists.
- Trip delete removes expenses, payments and people in an order that works with the restrict foreign keys (F2.AC10).

## Open questions
- [x] Copy for the remove confirmation: approved as written (2026-11-17).
- [x] Copy for the add form: field label "Person name" and button "Add person", approved (2026-11-17).
- [x] Copy for loading, empty, and failure states, and the person-not-found message: approved as written (2026-11-17).

## Decisions log
- 2026-11-17: Person name length? → 100 characters.
- 2026-11-17: Are names unique case-insensitively? → Yes; "Sam" and "sam" are the same on one trip.
- 2026-11-17: Removal flow? → Confirm first, like trip delete.
- 2026-11-17: List order? → Added order, oldest first.
- 2026-11-17: Maximum people per trip? → No limit.
- 2026-11-17: Messages approved as drafted? → Yes, for the six messages: "Enter a name.", "Names can be up to 100 characters.", "Someone on this trip already has that name.", "This person is in an expense or payment, so they can't be removed.", "Person added." / "Person removed.".
- 2026-11-17: Remove confirmation copy? → "Remove {name} from this trip?" with "Cancel" and "Remove person".
- 2026-11-17: Add form copy? → Field "Person name", button "Add person".
- 2026-11-17: Loading, empty, and failure copy? → "Loading people…"; "No people yet. Add the people on this trip."; "Could not add this person. Try again."; "Could not remove this person. Try again."; "This person is no longer on this trip."
- 2026-11-17: Add name rules (100 characters, unique per trip ignoring case) to product.md Business rules? → Yes; added as R9.
- 2026-11-17: Spec approved by the user. Status set to Approved.
