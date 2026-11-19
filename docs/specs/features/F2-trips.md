# F2 — Trips

_Status: Approved · Last updated: 2026-11-17 · Source: product.md — MVP scope (F2), Roles, Key terms, Business rules R8, Ownership rule_

## Summary
A logged-in user creates a trip with a name, sees a list of their own trips, and deletes a trip after confirming. Trips are the top-level container for people (F3), expenses (F4), balances (F5) and settle-up (F6). This feature is the first to use the F1 login check on trip data, and every trip request is also checked for ownership.

## User stories
- As a user, I want to create a trip with a name, so that I can start tracking its shared spending.
- As a user, I want to see a list of my trips, so that I can open the one I need.
- As a user, I want to delete a trip after confirming, so that I can remove trips I no longer need.

## Scope
**In:**
- Create a trip with a name.
- List the logged-in user's trips, newest first.
- Delete a trip, after a confirmation step. Deleting a trip removes everything in it (R8).
- Ownership check on every trip request: a user only sees and changes their own trips.
- Trip pages and endpoints that F3–F6 will extend. F2 creates only the trip itself.

**Out:**
- Editing or renaming a trip (product.md Assumptions: no editing). A mistake is fixed by deleting and creating again.
- Trip details beyond the name: no dates, currency, description or notes (product.md: one currency; nothing else is specified).
- Opening a trip to see its people, expenses or balances. Those screens arrive with F3–F5; F2's trip rows link to a trip page that shows only the name until then.
- Sharing a trip with another user (product.md "After the core").
- Trip counts, balances or totals on the list (balances arrive in F5).
- Limits on how many trips a user can have (none, per your answer).
- Duplicate-name checks (duplicates are allowed, per your answer).

## User flow & screens
Working screen names (no `docs/design` yet; these match F1's naming).

1. **Trips** (`/trips`). The page has two parts, top to bottom:
   - A **New trip** form: a Trip name field and a "Create trip" button.
   - The list of the user's trips, newest first. Each row shows the trip name and a Delete control. Clicking the name opens that trip's page.
2. **Create trip.** User types a name and clicks "Create trip".
   - Success → the new trip appears at the top of the list, the field is cleared, and a confirmation message is shown.
   - Validation error → message shown under the field; the typed name is kept.
3. **No trips yet** → empty state in place of the list (see States & errors).
4. **Delete trip.** User clicks Delete on a row.
   - A confirmation panel appears on that row with the sentence "This deletes the trip and all its people, expenses and payments. This cannot be undone." and buttons "Delete trip" and "Cancel".
   - "Cancel" → the panel closes; nothing changes.
   - "Delete trip" → the trip is removed and disappears from the list. A message "Trip deleted." is shown.
5. **Trip page** (`/trips/:id`). In F2 it shows only the trip name and a "Back to trips" link. Opening another user's trip ID shows the Not found page (see Edge cases).
6. **Logged out visitor** opens `/trips` or `/trips/:id` → redirected to **Log in** (F1 flow 6).

## Requirements
- **F2.R1** A trip has a name. The name is trimmed of leading and trailing spaces before it is checked and saved. (Stated: product.md Key terms "Trip: a named group"; trimming follows F1.R1's practice.)
- **F2.R2** A trip name must have at least one character after trimming, and at most 100 characters, counted in characters. Any characters are allowed. (Chosen: required, trimmed, max 100 characters.)
- **F2.R3** Two trips of the same user may have the same name. Creating a trip never checks for duplicates. (Chosen: duplicates allowed.)
- **F2.R4** A user can create any number of trips. (Chosen: no limit.)
- **F2.R5** Each trip belongs to exactly one user: the user who created it. The owner is set by the server from the logged-in session, never from the request. (Stated: product.md Roles, Ownership rule.)
- **F2.R6** The trips list shows only trips owned by the logged-in user, newest first by creation time. Each row shows the trip name only. (Chosen: newest first, name only. Stated: Ownership rule.)
- **F2.R7** Deleting a trip requires the user to click "Delete trip" in the confirmation panel. Deleting removes the trip and every person, expense and payment in it, in one transaction. (Stated: product.md R8. Chosen: confirmation sentence and button.)
- **F2.R8** Every trip request (list, create, view, delete) requires a logged-in session (F1.R10 check) and checks that the trip belongs to the session's user before reading or changing it. (Stated: product.md Roles, Ownership rule; F1 Scope: F2 applies the check.)
- **F2.R9** A request for a trip ID that does not exist, or that belongs to another user, gets the same "Not found" response. (Chosen: Not found for both.)
- **F2.R10** Trips are never edited. No endpoint or screen changes a trip's name after creation. (Stated: product.md Assumptions: No editing.)

## Data & contract
**Table `trips`** (new):

| Column | Type | Rules |
|---|---|---|
| `id` | unique ID | Primary key |
| `user_id` | reference to `users.id` | Required. Deleting the user deletes their trips (F1.AC13) |
| `name` | text | Required. Trimmed, 1–100 characters (F2.R1–R2) |
| `created_at` | timestamp | Set on insert. Sort key for the list (F2.R6) |

Index on `user_id` so the list query is fast. No unique constraint on `name` (F2.R3).

**Cascade (for F3–F6):** `people`, `expenses` and `payments` tables are not built yet. Each must reference `trips.id` with cascade delete, so deleting a trip removes them in the same transaction (F2.R7). F2 creates the trip table; the cascade is verified when those tables exist.

**API** (paths are the proposed shape; the plan confirms the framework's routing style):

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/trips` | none | 200 `{ "trips": [{ "id", "name", "createdAt" }] }`, newest first | 401 not logged in |
| POST | `/api/trips` | `{ "name": string }` | 201 `{ "trip": { "id", "name", "createdAt" } }` | 400 `{ "error": "name_required" \| "name_too_long" }`; 401 |
| GET | `/api/trips/:id` | none | 200 `{ "trip": { "id", "name", "createdAt" } }` | 404 `{ "error": "not_found" }` (also for other users' trips); 401 |
| DELETE | `/api/trips/:id` | none | 204 | 404 `{ "error": "not_found" }`; 401 |

Error shape for all errors: `{ "error": "<code>" }`. The UI maps codes to the copy in States & errors. The API never returns 403 for trips (F2.R9).

**Browser storage:** None. The session cookie is F1's.

## States & errors
**Copy below was approved by the user as written on 2026-11-17.**

| State | What the user sees |
|---|---|
| Loading list | "Loading your trips…" in place of the list |
| Empty list | "You have no trips yet. Create one above to get started." |
| Name empty or only spaces | Under the field: "Enter a trip name." |
| Name over 100 characters | Under the field: "Trip names can be up to 100 characters." |
| Create succeeds | New row at the top; field cleared; "Trip created." |
| Create fails (network or server) | "Could not create the trip. Try again." The typed name is kept. |
| Delete confirmation open | Panel on that row with the confirmation sentence and buttons (see flow) |
| Delete succeeds | Row removed; "Trip deleted." |
| Delete fails (network or server) | "Could not delete the trip. Try again." The row stays. |
| Trip not found (missing or not theirs) | Page: "This trip could not be found." with a "Back to trips" link |
| Logged out | Redirect to Log in (F1) |
| Session expired during a request | Redirect to Log in (F1) |

## Accessibility
- The name field has a visible label "Trip name". Error messages are linked to the field and announced when they appear.
- Each Delete control has an accessible name that includes the trip name, e.g. "Delete trip Paris 2026", so screen reader users can tell rows apart.
- The confirmation panel receives focus when it opens. "Cancel" is the first button in the panel's tab order. Escape closes the panel.
- After a successful delete, focus moves to the list heading, or to the empty-state message if the list is now empty.
- Status messages ("Trip created", "Trip deleted") use a polite live region.
- All controls are reachable by keyboard. Colors meet WCAG AA contrast for text and focus outlines.
- No animation is required; if a panel animates, it respects `prefers-reduced-motion`.

## Edge cases
- Name is only spaces → rejected (F2.R2). Name is 100 characters after trimming → accepted; 101 → rejected.
- Name with leading or trailing spaces → saved trimmed (F2.R1).
- Two trips with the same name → both saved, both listed (F2.R3).
- Two browser tabs: delete in one, then delete again in the other → second request returns 404; the row is removed and the message is "This trip could not be found."
- Deleting a trip while a create is in flight → no effect on the new trip.
- A user with a valid session whose account was deleted (F1) → all their trips are gone; requests return 401.
- Trip ID guessed from another user → 404, nothing revealed (F2.R9).
- Malformed trip ID in the URL (not a valid ID format) → 404, not a server error.
- Very many trips → list returns all trips in one response for MVP. (Pagination not in scope; no limit set. See Open questions.)
- Concurrent creates from two tabs → each saves its own trip; no conflict.

## Acceptance criteria
- **F2.AC1** Given a logged-in user, when they submit the name "Lisbon" on the trips form, then a trip named "Lisbon" is saved with them as owner and appears first in their list. _(R1, R5, R6)_
- **F2.AC2** Given a name with leading and trailing spaces, when it is saved, then the stored name has no leading or trailing spaces. _(R1)_
- **F2.AC3** Given a name that is empty or only spaces, when the user submits, then no trip is saved and "Enter a trip name." is shown. _(R2)_
- **F2.AC4** Given a name of 101 characters, when the user submits, then no trip is saved and "Trip names can be up to 100 characters." is shown; a name of exactly 100 characters is saved. _(R2)_
- **F2.AC5** Given a user already has a trip named "Lisbon", when they create another "Lisbon", then both are saved and both are listed. _(R3)_
- **F2.AC6** Given a user with several trips, when they open the list, then only their own trips appear, newest first, each row showing only the name. _(R6)_
- **F2.AC7** Given a user with no trips, when they open the list, then the empty-state message is shown and no rows appear. _(R6)_
- **F2.AC8** Given a trip, when the user clicks Delete and then Cancel, then the trip is unchanged and still listed. _(R7)_
- **F2.AC9** Given a trip, when the user clicks Delete and then "Delete trip", then the trip is removed from the list and "Trip deleted." is shown. _(R7)_
- **F2.AC10** Given a trip with people, expenses and payments (F3–F6), when it is deleted, then all of them are removed in the same transaction. _(R7; checked by code review)_
- **F2.AC11** Given user A's trip, when user B requests it by ID (GET or DELETE), then the response is 404 `not_found` and the trip is unchanged. _(R8, R9)_
- **F2.AC12** Given a logged-out visitor, when they call any `/api/trips` endpoint, then the response is 401 and no trip data is returned. _(R8)_
- **F2.AC13** Given a request to create a trip, when the body includes an owner or user ID, then the trip is still owned by the logged-in session's user. _(R5)_
- **F2.AC14** Given the trips table, when a trip is created, then no unique constraint on name blocks it. _(R3; checked by code review)_
- **F2.AC15** Given a trip-related request, when it runs, then no trip name is logged at info level or above and no session token appears in any log line. _(project logging rules)_

## Dependencies
- **Build order:** step 2. Needs F1 (login check and session). F3–F6 depend on this.
- **F1 (Registration and login):** supplies the session, the login check (F1.R10), and account deletion, which removes trips (F1.AC13).
- **F3 (People):** will reference `trips.id` with cascade delete. F2's delete rule (F2.R7) covers them.
- **External services:** none.

## Test plan
Unit tests only (project rules). Each test name includes its AC ID.

| Test | AC |
|---|---|
| Name normalization: trims spaces before save | F2.AC2 |
| Name validation: empty and spaces-only rejected; 100 accepted; 101 rejected; length counts characters | F2.AC3, F2.AC4 |
| Create with a fake repository: saved trip has the session's user as owner, ignores any owner in the body | F2.AC1, F2.AC13 |
| Create with a fake repository: duplicate names both saved (no duplicate check called) | F2.AC5 |
| List with a fake repository: returns only the session user's trips, newest first, name only | F2.AC6 |
| List with a fake repository: no trips returns an empty array | F2.AC7 |
| Delete: Cancel path makes no repository delete call | F2.AC8 |
| Delete: confirmed delete calls the repository once with the trip ID and owner | F2.AC9 |
| Get and delete with a fake repository: other user's trip ID returns not_found and calls no change | F2.AC11 |
| Trip endpoints with no session: handler is not called; 401 returned | F2.AC12 |
| Fake logger: create, list and delete log no trip name and no session token | F2.AC15 |

**Code review** (needs a real database or the full app; not unit-testable):
- F2.AC10 — cascade delete and single transaction (applies once F3–F6 tables exist).
- F2.AC11 — ownership filter in the real trip queries (end-to-end check).
- F2.AC12 — real 401 from the server, not just the unit check.
- F2.AC14 — no unique constraint on `trips.name`.
- Index on `trips.user_id` exists.

## Open questions
- [x] Copy in States & errors and the confirmation sentence in the flow: approved as written (2026-11-17).
- [x] Large lists: all trips in one response is acceptable for MVP (2026-11-17). No pagination, no cap.
- [x] Trip page (`/trips/:id`): name only until F3–F5 (2026-11-17).

## Decisions log
- 2026-11-17: Trip name rules? → Required, trimmed, max 100 characters.
- 2026-11-17: Duplicate trip names? → Allowed.
- 2026-11-17: List order and row content? → Newest first, name only.
- 2026-11-17: Delete confirmation? → Confirmation sentence and "Delete trip" button, no password re-entry.
- 2026-11-17: Where to create a trip? → Form on the Trips page.
- 2026-11-17: Response for another user's trip? → Not found, same as a missing trip.
- 2026-11-17: Trip limit per user? → None.
- 2026-11-17: Spec approved by the user. Status set to Approved. The three open questions above remain open (copy review, large lists, trip page content).
- 2026-11-17: Copy final? → Final as written.
- 2026-11-17: Large lists acceptable for MVP? → Yes, return all trips in one response.
- 2026-11-17: Trip page content until F3–F5? → Name only.
