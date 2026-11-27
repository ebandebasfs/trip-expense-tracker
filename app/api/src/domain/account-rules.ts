export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_EMPTY_MESSAGE = 'Enter a password.';
export const PASSWORD_TOO_SHORT_MESSAGE = 'Password must be at least 8 characters.';
export const PASSWORD_TOO_LONG_MESSAGE = 'Password must be 128 characters or fewer.';

// One "@", text before it, and a domain with a dot that has text on both sides.
const EMAIL_PATTERN = /^[^@]+@[^.@]+(\.[^.@]+)+$/;

/** Trims and lowercases an email before it is saved or compared. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Basic email format check (F1.R3). Callers normalize the email first. */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/**
 * Checks a password against the length rule (F1.R2).
 * Returns the message to show, or null when the password is accepted.
 * The password is not trimmed. Length counts Unicode code points.
 */
export function checkPassword(password: string): string | null {
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
