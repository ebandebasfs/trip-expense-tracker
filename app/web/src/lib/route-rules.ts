// Route rules for the web app (F1.R10, F1.AC10). Pure functions, no React or Next imports.

export const LOGIN_PATH = '/login';
export const REGISTER_PATH = '/register';
export const TRIPS_PATH = '/trips';

// Any value used as a base for parsing. It is never sent anywhere.
const PARSE_BASE = 'http://localhost';

// Control characters and backslashes can make a browser read a path as a different host.
const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f\\]/;

/** Drops the query string, the hash and a trailing slash (but keeps "/"). */
function pathOnly(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

/** True for `/trips` and anything under it. `/tripsfoo` is not a trip path. */
function isTripPath(path: string): boolean {
  return path === TRIPS_PATH || path.startsWith(`${TRIPS_PATH}/`);
}

/**
 * Returns where to send the visitor, or null to show the page.
 * A logged-out visitor on a trip path goes to Log in (F1.AC10).
 * A logged-in visitor on Log in or Register goes to Trips.
 */
export function routeFor(path: string, loggedIn: boolean): string | null {
  const current = pathOnly(path);
  if (!loggedIn && isTripPath(current)) {
    return LOGIN_PATH;
  }
  if (loggedIn && (current === LOGIN_PATH || current === REGISTER_PATH)) {
    return TRIPS_PATH;
  }
  return null;
}

/**
 * Accepts only a path inside this app, for the `next` value after log in (F1.AC7).
 * Anything else (missing, external, protocol-relative, or with control characters)
 * falls back to Trips. The result keeps the path, query and hash.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== 'string' || next === '' || UNSAFE_PATH_CHARS.test(next)) {
    return TRIPS_PATH;
  }
  if (!next.startsWith('/') || next.startsWith('//')) {
    return TRIPS_PATH;
  }
  let url: URL;
  try {
    url = new URL(next, PARSE_BASE);
  } catch {
    return TRIPS_PATH;
  }
  if (url.origin !== new URL(PARSE_BASE).origin) {
    return TRIPS_PATH;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
