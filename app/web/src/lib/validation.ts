// Client-side checks for fast feedback (F1 spec, Validation). They mirror the API rules in
// app/api/src/domain/account-rules.ts and the service order. The server result always wins.

export const EMAIL_EMPTY_MESSAGE = 'Enter your email address.';
export const EMAIL_INVALID_MESSAGE = 'Enter a valid email address, such as name@example.com.';
export const LOGIN_EMPTY_MESSAGE = 'Enter your email and password.';
export const PASSWORD_EMPTY_MESSAGE = 'Enter a password.';
export const PASSWORD_TOO_SHORT_MESSAGE = 'Password must be at least 8 characters.';
export const PASSWORD_TOO_LONG_MESSAGE = 'Password must be 128 characters or fewer.';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** The input a message belongs to. `null` means a form-level message. */
export type ValidationField = 'email' | 'password' | null;

export interface ValidationError {
  field: ValidationField;
  message: string;
}

// One "@", text before it, and a domain with a dot that has text on both sides.
const EMAIL_PATTERN = /^[^@]+@[^.@]+(\.[^.@]+)+$/;

/** Trims and lowercases an email, as the API does before it checks or saves it. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Basic email format check (F1.R3). Expects a normalized email. */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/**
 * Checks a new password against the length rule (F1.R2).
 * Returns the message to show, or null. The password is not trimmed.
 * Length counts Unicode code points, not UTF-16 units.
 */
export function checkNewPassword(password: string): string | null {
  if (password.length === 0) {
    return PASSWORD_EMPTY_MESSAGE;
  }
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return PASSWORD_TOO_LONG_MESSAGE;
  }
  return null;
}

/** First problem with a registration form, checked in the same order as the API. */
export function validateRegistration(email: string, password: string): ValidationError | null {
  const normalized = normalizeEmail(email);
  if (normalized === '') {
    return { field: 'email', message: EMAIL_EMPTY_MESSAGE };
  }
  if (!isValidEmail(normalized)) {
    return { field: 'email', message: EMAIL_INVALID_MESSAGE };
  }
  const passwordMessage = checkNewPassword(password);
  if (passwordMessage !== null) {
    return { field: 'password', message: passwordMessage };
  }
  return null;
}

/** First problem with a log in form, checked in the same order as the API. */
export function validateLogin(email: string, password: string): ValidationError | null {
  const normalized = normalizeEmail(email);
  if (normalized === '' || password === '') {
    return { field: null, message: LOGIN_EMPTY_MESSAGE };
  }
  if (!isValidEmail(normalized)) {
    return { field: 'email', message: EMAIL_INVALID_MESSAGE };
  }
  return null;
}
