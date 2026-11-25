// Browser client for the API (F1 spec, API). Calls go to /api/*, which Next rewrites to the API,
// so the session cookie stays same-origin. Errors use the API shape { error, field }.

import { LOGIN_PATH } from './route-rules';
import type { ValidationField } from './validation';

export const API_PREFIX = '/api';

/** Shown for network errors and unexpected responses. It never carries details. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Try again.';

export interface AuthUser {
  id: string;
  email: string;
}

/** A failed call. `sessionExpired` means the visitor was sent to Log in with no message. */
export class ApiError extends Error {
  readonly status: number;
  readonly field: ValidationField;
  readonly sessionExpired: boolean;

  constructor(message: string, status: number, field: ValidationField, sessionExpired = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
    this.sessionExpired = sessionExpired;
  }
}

export interface ApiClientOptions {
  /** Defaults to the global fetch. Tests pass a fake. */
  fetchImpl?: typeof fetch;
  /** Defaults to a full page load of /login. */
  redirectToLogin?: () => void;
}

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

/** Body of an error from the API. A bare 401 from the session guard has no `field`. */
interface AuthFailureBody {
  error: string;
  field: ValidationField;
}

function browserRedirectToLogin(): void {
  window.location.assign(LOGIN_PATH);
}

function isAuthFailureBody(value: unknown): value is AuthFailureBody {
  if (typeof value !== 'object' || value === null || !('field' in value)) {
    return false;
  }
  const { error, field } = value as { error?: unknown; field?: unknown };
  return typeof error === 'string' && (field === null || field === 'email' || field === 'password');
}

async function readJsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // Not JSON. The caller falls back to the generic message.
    return null;
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const redirectToLogin = options.redirectToLogin ?? browserRedirectToLogin;

  /**
   * Sends one request and returns the response when it succeeds.
   * - A 401 with the API error shape (wrong credentials) shows its message.
   * - Any other 401 (no valid session) redirects to Log in with no message.
   * - Anything else becomes an ApiError with the API message, or the generic one.
   */
  async function send(method: HttpMethod, path: string, body?: unknown): Promise<Response> {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    let response: Response;
    try {
      response = await fetchImpl(`${API_PREFIX}${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(GENERIC_ERROR_MESSAGE, 0, null);
    }

    if (response.ok) {
      return response;
    }

    const errorBody = await readJsonOrNull(response);
    if (isAuthFailureBody(errorBody)) {
      throw new ApiError(errorBody.error, response.status, errorBody.field);
    }
    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError('', 401, null, true);
    }
    throw new ApiError(GENERIC_ERROR_MESSAGE, response.status, null);
  }

  /** Reads a JSON success body. A body that does not parse is an unexpected response. */
  async function readSuccessJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(GENERIC_ERROR_MESSAGE, response.status, null);
    }
  }

  return {
    /** For trip endpoints (F2 onward). Returns the parsed body, or undefined for 204. */
    async request<T = unknown>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
      const response = await send(method, path, body);
      if (response.status === 204) {
        return undefined as T;
      }
      return readSuccessJson<T>(response);
    },

    /** Creates the account and starts a session (F1.R1, R6). */
    async register(email: string, password: string): Promise<AuthUser> {
      return readSuccessJson<AuthUser>(await send('POST', '/register', { email, password }));
    },

    /** Checks the credentials and starts a session (F1.R7, R8). */
    async login(email: string, password: string): Promise<AuthUser> {
      return readSuccessJson<AuthUser>(await send('POST', '/login', { email, password }));
    },

    /** Returns the logged-in user. A 401 with no session sends the visitor to Log in (F1.AC10). */
    async me(): Promise<AuthUser> {
      return readSuccessJson<AuthUser>(await send('GET', '/me'));
    },

    /** Ends the session (F1.R9). */
    async logout(): Promise<void> {
      await send('POST', '/logout');
    },

    /** Deletes the account after the password check (F1.R11). */
    async deleteAccount(password: string): Promise<void> {
      await send('DELETE', '/account', { password });
    },
  };
}

export const apiClient = createApiClient();
