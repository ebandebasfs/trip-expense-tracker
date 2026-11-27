/**
 * Injection tokens for the auth providers. They live in their own file so that
 * `auth.module.ts` and `session.guard.ts` can both import them without importing each other.
 */

/** Injection token for the UserRepository port. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
/** Injection token for the SessionRepository port. */
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
/** Injection token for the PasswordHasher port. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
/** Injection token for the UnitOfWork port (logout and account deletion). */
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
/** Injection token for the AuthLogger port. */
export const AUTH_LOGGER = Symbol('AUTH_LOGGER');
