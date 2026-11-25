/** Name of the cookie that holds the session token (F1.R8). */
export const SESSION_COOKIE_NAME = 'session';

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  /** Sent to every path, so /api/* requests get the cookie. */
  path: '/';
}

/**
 * Options for the session cookie. No Max-Age or Expires, so the cookie ends when the
 * browser closes or the user logs out (F1.R8). Secure is set in production only.
 */
export function sessionCookieOptions(env: NodeJS.ProcessEnv = process.env): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

/**
 * Reads the session token from a Cookie header. Returns null when the header or the
 * session cookie is missing or empty.
 */
export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (cookieHeader === undefined) return null;
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(separator + 1).trim();
    return value === '' ? null : value;
  }
  return null;
}
