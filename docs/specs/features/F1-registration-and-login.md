# F1 — Registration and login

_Status: Approved · Last updated: 2026-11-17 · Source: product.md — MVP scope (F1), Roles, Assumptions, Business rules R8_

## Summary
A visitor creates an account with an email and password, then logs in and out. Every trip page and action is closed to anyone who is not logged in, and each request is checked against the logged-in user. A user can also delete their account after confirming with their password. This feature is the base for all other features: no trip data can be reached until it works.

## User stories
- As a visitor, I want to register with an email and password, so that I can start tracking trips.
- As a user, I want to log in and log out, so that only I can reach my trips.
- As a user, I want to delete my account after confirming my password, so that my data is removed.

## Scope
**In:**
- Register with email and password; the account logs in straight away.
- Log in with email and password.
- Log out.
- A login session that lasts until the user logs out or closes the browser.
- A login check that every trip endpoint (F2 onward) uses. F1 builds the check; each later feature applies it.
- Delete account, after re-entering the password. Deletes the account and all its data.

**Out:**
- Email verification and password reset (product.md Assumptions).
- Limits on failed login attempts. Not in product.md; deferred. Brute-force protection can be a later scope change.
- Changing a password, email, or any other account detail (product.md: no editing).
- "Remember me" or sessions that outlast the browser.
- Logging out other devices.
- Trip ownership checks on specific trip pages and actions: F2 onward. F1 supplies the login check they use.
- Display names or profiles. product.md says people are names only, and users have no other account data.

## User flow & screens
Screens (no `docs/design` yet, so names are working titles):

1. **Register** (`/register`). Email and password fields and a "Create account" button. Link: "Already have an account? Log in".
   - Success → logged in → **Trips** page (F2). Until F2 exists, a placeholder page.
   - Duplicate email or validation error → message shown on this screen, fields kept (password cleared).
2. **Log in** (`/login`). Email and password fields, "Log in" button. Link: "Create an account".
   - Success → **Trips** page.
   - Failure → message shown, password cleared.
3. **Logged-in user visits Register or Log in** → redirected to **Trips**.
4. **Log out** (in the header, on every logged-in screen) → session ends → **Log in** screen.
5. **Account** (`/account`), linked from the header. Shows the account email and a "Delete account" section.
   - User enters password and clicks "Delete account" → confirmation sentence repeated on screen: "This deletes your account and every trip in it. This cannot be undone." → final "Delete my account" button.
   - Wrong password → message on screen, nothing deleted.
   - Success → logged out → **Log in** screen with message "Your account has been deleted."
6. **Any trip page, logged out** (e.g. `/trips`) → redirected to **Log in**. After login, the user lands on the page they asked for if it is a safe in-app path; otherwise on **Trips**.

## Requirements
- **F1.R1** Registration takes an email and a password. Before saving, the email is trimmed and lowercased. Emails are unique across all accounts. (product.md Assumptions: email and password login; Key terms; inferred: email is the login identifier.)
- **F1.R2** Password length is 8 to 128 characters, counted in characters. Passwords may contain any characters, including spaces. No other composition rules. The password is never trimmed. (Chosen: min 8, no other rules; max 128.)
- **F1.R3** The email must have one `@`, text on both sides of it, and a dot in the domain part. Otherwise registration and login reject it with a message and nothing is saved or checked further. (Chosen: basic email check.)
- **F1.R4** Passwords are stored only as a salted hash made with a slow password hashing function. The plain password is never stored, logged, or returned. (product.md Assumptions: hashed passwords; project rules: store passwords only as hashes.)
- **F1.R5** Registering with an email that already has an account saves nothing and shows "This email is already registered." (Chosen.)
- **F1.R6** A successful registration logs the new user in in the same step. (Chosen: log in automatically.)
- **F1.R7** Login checks the email and password. If either is wrong, or the email has no account, the same message is shown. (Chosen: generic message. Inferred from the same choice: no login attempt reveals which emails have accounts.)
- **F1.R8** A successful login starts a session. The session is kept in a cookie that is not readable by page scripts. The cookie has no expiry date, so it ends when the browser closes. The session also ends when the user logs out. (Chosen: until logout or browser close.)
- **F1.R9** Log out ends the session on the server and in the browser, then shows the Log in screen.
- **F1.R10** Every trip endpoint (F2 onward) rejects a request with no valid session. The rejection returns no trip data. (product.md Done when: a logged-out visitor cannot reach any trip.)
- **F1.R11** Delete account requires the correct password. Deleting removes the user, and in one transaction all their trips, people, expenses, and payments. Their sessions end. (product.md R8 applied to the account; user choice: delete account and all its trips; password re-entry. Subject to the product.md edit below.)
- **F1.R12** Passwords, session IDs, and tokens are never written to logs or shown in error messages. (product.md: logging rules; project rules.)

## Data & contract
**Stored data**
- `user`: `id`, `email` (unique, lowercase), `password_hash`, `created_at` (UTC). Nothing else.
- `session`: a server-side record linked to a user, or a signed cookie. The choice goes to the plan. Either way, logout and account deletion must make it invalid at once.

**Requests and responses** (logical contract; paths and status codes are proposals, finalized in the plan)
- `POST /register` — body `{ email, password }`. 201 on success with the user's `id` and `email`, and sets the session cookie. Errors: 400 validation (R1–R3), 409 duplicate email (R5).
- `POST /login` — body `{ email, password }`. 200 on success, sets the session cookie. 401 on wrong credentials (R7). 400 on validation.
- `POST /logout` — no body. 204; clears the session cookie. Idempotent.
- `DELETE /account` — body `{ password }`. 204 on success, clears the session cookie. 401 if the password is wrong. 401 if not logged in.
- Any F2+ endpoint with no valid session → 401, no body data.

**Error shape:** `{ "error": "<message text from States & errors>", "field": "email" | "password" | null }`. `field` names the input to mark. `null` for form-level errors.

**Cookie:** `HttpOnly`, `SameSite=Lax`, `Secure` in production, no `Max-Age` or `Expires`.

## States & errors
Messages are **proposed** wording (you review them; see Open questions).

| Where | Condition | Message |
|---|---|---|
| Register / Log in | Email empty | "Enter your email address." |
| Register | Email fails format check (R3) | "Enter a valid email address, such as name@example.com." |
| Register | Password under 8 characters | "Password must be at least 8 characters." |
| Register | Password over 128 characters | "Password must be 128 characters or fewer." |
| Register | Password empty | "Enter a password." |
| Register | Duplicate email (R5) | "This email is already registered." |
| Log in | Email or password empty | "Enter your email and password." |
| Log in | Wrong email or password (R7) | "Email or password is incorrect." |
| Account | Password empty | "Enter your password to delete your account." |
| Account | Wrong password (R11) | "Password is incorrect. Your account was not deleted." |
| Log in (after deletion) | Success of R11 | "Your account has been deleted." |
| Any | Server or database error | "Something went wrong. Try again." |
| Any | Session expired or missing on a trip page (R10) | Redirect to Log in; no message needed. |

- **Loading:** submit buttons are disabled and show "Creating account…", "Logging in…", or "Deleting…" while waiting. Inputs keep their values.
- **Empty state:** none. These screens have no lists.
- **Validation:** checked on the client for fast feedback and again on the server. The server result wins.

## Accessibility
- Every input has a visible label. Placeholders are not labels.
- Inputs use `autocomplete="email"`, `autocomplete="new-password"` on Register and the Account password check, and `autocomplete="current-password"` on Log in.
- Errors appear next to the field and in a text region announced to screen readers (`role="alert"`). After a failed submit, focus moves to the first field with an error.
- The whole form works with the keyboard. Enter submits. Focus order follows the visual order.
- Focus rings stay visible. Text and error colors meet WCAG AA contrast (4.5:1 for body text).
- The delete confirmation is a plain sentence and a button, not a timed action. No focus traps other than an open dialog, if one is used.
- Reduced motion: no animations in F1.

## Edge cases
- Email with spaces or capital letters (" Sam@Example.com ") → saved and matched as "sam@example.com" (R1).
- Two registrations with the same email at the same moment → the database unique rule blocks the second; it gets the duplicate message (R5). Checked in code review.
- Double-click on "Create account" or "Log in" → one account, one session. Buttons disable on the first click.
- Password with leading or trailing spaces → kept as typed. Password of exactly 8 or 128 characters → accepted. 7 or 129 → rejected.
- Non-English letters and emoji in the password → accepted; length counts characters, not bytes.
- Logged in on two tabs, delete account in one → the other tab's next request is rejected (R10).
- Log out in one tab → other tabs' next request is rejected.
- Logged-in user opens Log in or Register → redirected to Trips.
- Account deleted while the user has a trip page open → next action returns to the Log in screen with the deletion message.
- Wrong password on delete → nothing removed, session still valid.
- Browser closed and reopened → user must log in again (session cookie, R8).

## Acceptance criteria
- **F1.AC1** Given a visitor on Register, when they submit a new valid email and an 8-character password, then the account is saved, they are logged in, and they land on Trips. _(R1, R6)_
- **F1.AC2** Given an account exists for "sam@example.com", when someone registers with "sam@example.com", then no account is saved and the message "This email is already registered." is shown. _(R5)_
- **F1.AC3** Given the input " Sam@Example.COM ", when registering, then the saved email is "sam@example.com". _(R1)_
- **F1.AC4** Given an email without an `@`, without a dot in the domain, or with an empty part, when registering or logging in, then the email-format message is shown and no account is created or checked. _(R3)_
- **F1.AC5** Given a password of 7, 8, 128, or 129 characters, when registering, then 7 and 129 are rejected with their messages and 8 and 128 are accepted. _(R2)_
- **F1.AC6** Given a registration, when the account is saved, then the stored password is a hash that differs from the typed password and is not equal to it. _(R4)_
- **F1.AC7** Given an account with a known password, when the user logs in with the correct email and password, then a session is created and the response sets the session cookie. _(R8)_
- **F1.AC8** Given a wrong password, or an email with no account, when logging in, then both show "Email or password is incorrect." and no session is created. _(R7)_
- **F1.AC9** Given a logged-in user, when they log out, then the session is ended and a later request with the old cookie is rejected. _(R9)_
- **F1.AC10** Given no valid session, when any trip endpoint is requested, then the request is rejected and no trip data is returned. _(R10)_
- **F1.AC11** Given a valid session for user A, when user A requests a trip that belongs to user B, then the request is refused. Ownership checks are per endpoint (F2+); F1 defines the rule and the check. _(R10; checked by code review)_
- **F1.AC12** Given a logged-in user, when they enter a wrong password on Delete account, then the message is shown and no data is deleted. _(R11)_
- **F1.AC13** Given a logged-in user with trips, people, expenses, and payments, when they delete the account with the correct password, then all their rows are removed in one transaction and their sessions end. _(R11; checked by code review)_
- **F1.AC14** Given the session cookie, when registering, logging in, and logging out, then the cookie has `HttpOnly` set and no `Expires` or `Max-Age`. _(R8)_
- **F1.AC15** Given a register, login, or delete account request, when it runs, then no password, session ID, or token appears in any log line. _(R12)_

## Dependencies
- **Build order:** step 1. Everything else needs F1.
- **F2 (Trips):** the Trips page and the first endpoint to use the login check. Until F2 is built, the post-login destination is a placeholder page.
- **Stack:** not chosen yet. The plan picks the framework, hashing function, session store, and test tools. The plan must keep the rules above.
- **External services:** none. No email sending (product.md: no email verification or password reset).
- **Approval:** authentication always needs a person to review and approve the change (project rules).

## Test plan
Unit tests only (project rules). Each test name includes its AC ID.

| Test | AC |
|---|---|
| Email normalization: trims and lowercases before save | F1.AC3 |
| Email format check accepts valid, rejects missing `@`, missing domain dot, empty parts | F1.AC4 |
| Password length: 7 and 129 rejected; 8 and 128 accepted; counts characters, not bytes | F1.AC5 |
| Registration with a fake repository: duplicate email returns the duplicate message and saves nothing | F1.AC2 |
| Registration with a fake hasher: saved value is the hash, not the typed password | F1.AC6 |
| Login with a fake repository and fake hasher: correct credentials create a session | F1.AC7 |
| Login: wrong password and unknown email return the same message and create no session | F1.AC8 |
| Logout with a fake session store: old session ID is rejected afterwards | F1.AC9 |
| Login check with no session: trip handler is not called, no data returned | F1.AC10 |
| Delete account: wrong password returns the message and calls no delete | F1.AC12 |
| Session cookie options: `HttpOnly` set; no `Expires` or `Max-Age` | F1.AC14 |
| Fake logger: register, login, and delete calls log none of the password, session ID, or token | F1.AC15 |
| Successful registration returns a session and the Trips destination | F1.AC1 |

**Code review** (needs a real database or the full app; not unit-testable):
- F1.AC11 — ownership check in every trip query.
- F1.AC13 — cascade delete and single transaction.
- Unique constraint on `email` (supports F1.AC2 under concurrent sign-up).
- Session invalidation on logout and account deletion in the real session store (supports F1.AC9, F1.AC13).

## Open questions
- [x] Proposed messages in States & errors approved with the spec (2026-11-17).
- [x] product.md change for account deletion applied (2026-11-17).

## Decisions log
- 2026-11-17: Password rules? → Minimum 8 characters, no other rules.
- 2026-11-17: How long does a login last? → Until logout or browser close.
- 2026-11-17: Registering with an existing email? → Show "This email is already registered".
- 2026-11-17: After registering? → Log in automatically and open the trips page.
- 2026-11-17: Login error wording? → "Email or password is incorrect" for both cases.
- 2026-11-17: Limit failed login attempts? → Out of scope for MVP.
- 2026-11-17: Email case-insensitive? → Yes; same account.
- 2026-11-17: Can a user delete their own account in F1? → Yes, delete account and all its trips. **Not in product.md**; a product.md edit is proposed (see below).
- 2026-11-17: Confirmation for account deletion? → Re-enter password.
- 2026-11-17: Scope for account deletion? → Keep it; propose the product.md edit. Pending your agreement.
- 2026-11-17: Email format check? → Basic (one `@`, text both sides, dot in domain).
- 2026-11-17: Password maximum length? → 128 characters.
- 2026-11-17: Who writes the messages? → I propose the wording; the user reviews it.
- 2026-11-17: Where is "Delete account"? → Account page, linked from the header.
- 2026-11-17: Spec approved by the user. Status set to Approved. The product.md edit was approved and applied the same day.

**Proposed product.md edit (not applied):**
- MVP table, F1 "What it includes": add "delete own account after re-entering password, removing all their trips".
- Roles table, User "Can do": add "delete their own account".
