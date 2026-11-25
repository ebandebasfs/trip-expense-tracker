import 'reflect-metadata';
import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import {
  AuthController,
  type CookieRequest,
  type CookieResponse,
  SERVER_ERROR_MESSAGE,
} from './auth.controller';
import {
  type AuthFailure,
  type AuthResult,
  type AuthService,
  type AuthUser,
  DELETE_PASSWORD_WRONG_MESSAGE,
  type DeleteAccountResult,
  EMAIL_TAKEN_MESSAGE,
  LOGIN_FAILED_MESSAGE,
} from './auth.service';
import { SESSION_COOKIE_NAME, type SessionCookieOptions } from './session-cookie';
import { type AuthenticatedRequest, SessionGuard } from './session.guard';

interface CookieCall {
  name: string;
  value: string;
  options: SessionCookieOptions;
}

class FakeResponse implements CookieResponse {
  readonly set: CookieCall[] = [];
  readonly cleared: CookieCall[] = [];

  cookie(name: string, value: string, options: SessionCookieOptions): void {
    this.set.push({ name, value, options });
  }

  clearCookie(name: string, options: SessionCookieOptions): void {
    this.cleared.push({ name, value: '', options });
  }
}

/** Records the calls the controller makes and returns the results set by each test. */
class FakeAuthService {
  registerResult: AuthResult = {
    ok: true,
    user: { id: 'user-1', email: 'sam@example.com' },
    token: 'token-1',
  };
  loginResult: AuthResult = this.registerResult;
  deleteResult: DeleteAccountResult = { ok: true };
  /** When set, the next register call throws this error. */
  throwOnRegister: Error | null = null;

  readonly registerCalls: Array<[string, string]> = [];
  readonly loginCalls: Array<[string, string]> = [];
  readonly logoutCalls: string[] = [];
  readonly deleteCalls: Array<[string, string]> = [];

  async register(email: string, password: string): Promise<AuthResult> {
    this.registerCalls.push([email, password]);
    if (this.throwOnRegister !== null) {
      throw this.throwOnRegister;
    }
    return this.registerResult;
  }

  async login(email: string, password: string): Promise<AuthResult> {
    this.loginCalls.push([email, password]);
    return this.loginResult;
  }

  async logout(token: string): Promise<void> {
    this.logoutCalls.push(token);
  }

  async deleteAccount(userId: string, password: string): Promise<DeleteAccountResult> {
    this.deleteCalls.push([userId, password]);
    return this.deleteResult;
  }

  /** The user returned for GET /me. Null means the user no longer exists. */
  currentUserResult: AuthUser | null = { id: 'user-1', email: 'sam@example.com' };
  readonly currentUserCalls: string[] = [];

  async currentUser(userId: string): Promise<AuthUser | null> {
    this.currentUserCalls.push(userId);
    return this.currentUserResult;
  }

  asService(): AuthService {
    return this as unknown as AuthService;
  }
}

function failure(error: string, field: AuthFailure['field']): AuthFailure {
  return { ok: false, error, field };
}

/** Awaits a promise that must reject with an HttpException and returns it. */
async function rejectionOf(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the promise to reject');
}

function httpCodeOf(handler: object): number | undefined {
  return Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined;
}

describe('AuthController', () => {
  let auth: FakeAuthService;
  let controller: AuthController;
  let response: FakeResponse;

  beforeEach(() => {
    auth = new FakeAuthService();
    controller = new AuthController(auth.asService());
    response = new FakeResponse();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('F1.AC1 register returns the new user with 201 and sets the session cookie', async () => {
    const user = await controller.register({ email: 'sam@example.com', password: 'eight888' }, response);

    expect(user).toEqual({ id: 'user-1', email: 'sam@example.com' });
    expect(httpCodeOf(AuthController.prototype.register)).toBe(HttpStatus.CREATED);
    expect(response.set).toHaveLength(1);
    expect(response.set[0].name).toBe(SESSION_COOKIE_NAME);
    expect(response.set[0].value).toBe('token-1');
  });

  it('F1.AC1 register passes the typed email and password to the service', async () => {
    await controller.register({ email: ' Sam@Example.COM ', password: 'eight888' }, response);

    expect(auth.registerCalls).toEqual([[' Sam@Example.COM ', 'eight888']]);
  });

  it('F1.AC2 register with a taken email returns 409 with the message and field, and sets no cookie', async () => {
    auth.registerResult = failure(EMAIL_TAKEN_MESSAGE, 'email');

    const error = await rejectionOf(
      controller.register({ email: 'sam@example.com', password: 'eight888' }, response),
    );

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toEqual({ error: EMAIL_TAKEN_MESSAGE, field: 'email' });
    expect(response.set).toEqual([]);
  });

  it('F1.AC7 login with the correct credentials returns the user with 200 and sets the session cookie', async () => {
    auth.loginResult = {
      ok: true,
      user: { id: 'user-1', email: 'sam@example.com' },
      token: 'token-login',
    };

    const user = await controller.login({ email: 'sam@example.com', password: 'eight888' }, response);

    expect(user).toEqual({ id: 'user-1', email: 'sam@example.com' });
    expect(httpCodeOf(AuthController.prototype.login)).toBe(HttpStatus.OK);
    expect(response.set).toHaveLength(1);
    expect(response.set[0].name).toBe(SESSION_COOKIE_NAME);
    expect(response.set[0].value).toBe('token-login');
  });

  it('F1.AC8 login with wrong credentials returns 401 with the generic message and sets no cookie', async () => {
    auth.loginResult = failure(LOGIN_FAILED_MESSAGE, null);

    const error = await rejectionOf(
      controller.login({ email: 'sam@example.com', password: 'wrong-pass' }, response),
    );

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toEqual({ error: LOGIN_FAILED_MESSAGE, field: null });
    expect(response.set).toEqual([]);
  });

  it('F1.AC9 logout ends the session for the cookie token and clears the cookie with 204', async () => {
    const request: CookieRequest = { headers: { cookie: 'session=token-1' } };

    await controller.logout(request, response);

    expect(auth.logoutCalls).toEqual(['token-1']);
    expect(httpCodeOf(AuthController.prototype.logout)).toBe(HttpStatus.NO_CONTENT);
    expect(response.cleared).toHaveLength(1);
    expect(response.cleared[0].name).toBe(SESSION_COOKIE_NAME);
  });

  it('F1.AC9 logout with no cookie still clears the cookie and calls no service method', async () => {
    const request: CookieRequest = { headers: {} };

    await expect(controller.logout(request, response)).resolves.toBeUndefined();

    expect(auth.logoutCalls).toEqual([]);
    expect(response.cleared).toHaveLength(1);
  });

  it('F1.AC12 delete with the wrong password returns 401 with the message and clears no cookie', async () => {
    auth.deleteResult = failure(DELETE_PASSWORD_WRONG_MESSAGE, 'password');
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-1' }, userId: 'user-1' };

    const error = await rejectionOf(
      controller.deleteAccount(request, { password: 'wrong-pass' }, response),
    );

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toEqual({ error: DELETE_PASSWORD_WRONG_MESSAGE, field: 'password' });
    expect(auth.deleteCalls).toEqual([['user-1', 'wrong-pass']]);
    expect(response.cleared).toEqual([]);
  });

  it('F1.AC12 delete with the correct password returns 204 and clears the cookie', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-1' }, userId: 'user-1' };

    await controller.deleteAccount(request, { password: 'eight888' }, response);

    expect(auth.deleteCalls).toEqual([['user-1', 'eight888']]);
    expect(httpCodeOf(AuthController.prototype.deleteAccount)).toBe(HttpStatus.NO_CONTENT);
    expect(response.cleared).toHaveLength(1);
  });

  it('F1.AC10 delete throws 401 when no user ID reached the handler', async () => {
    const request: AuthenticatedRequest = { headers: {} };

    await expect(
      controller.deleteAccount(request, { password: 'eight888' }, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.deleteCalls).toEqual([]);
  });

  it('F1.AC10 me returns the signed-in user id and email, never a password hash', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-1' }, userId: 'user-1' };

    const user = await controller.me(request);

    expect(user).toEqual({ id: 'user-1', email: 'sam@example.com' });
    expect(user).not.toHaveProperty('passwordHash');
    expect(auth.currentUserCalls).toEqual(['user-1']);
  });

  it('F1.AC10 me throws 401 with no data when the user no longer exists', async () => {
    auth.currentUserResult = null;
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-1' }, userId: 'user-1' };

    await expect(controller.me(request)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.currentUserCalls).toEqual(['user-1']);
  });

  it('F1.AC10 me throws 401 and calls no service method when no user ID reached the handler', async () => {
    const request: AuthenticatedRequest = { headers: {} };

    await expect(controller.me(request)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.currentUserCalls).toEqual([]);
  });

  it('F1.AC10 me is guarded by SessionGuard', () => {
    const guards: unknown = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.me);
    expect(guards).toEqual([SessionGuard]);
  });

  it('F1.AC14 session cookies are HttpOnly with no Expires or Max-Age, when set and when cleared', async () => {
    await controller.register({ email: 'sam@example.com', password: 'eight888' }, response);
    await controller.logout({ headers: { cookie: 'session=token-1' } }, response);

    for (const call of [...response.set, ...response.cleared]) {
      expect(call.options.httpOnly).toBe(true);
      expect(call.options.sameSite).toBe('lax');
      expect(call.options).not.toHaveProperty('maxAge');
      expect(call.options).not.toHaveProperty('expires');
    }
  });

  it('F1.AC15 an unexpected error returns the generic 500 message and logs no error detail', async () => {
    auth.throwOnRegister = new Error('database row user-42 token-secret');
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const error = await rejectionOf(
      controller.register({ email: 'sam@example.com', password: 'eight888' }, response),
    );

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.getResponse()).toEqual({ error: SERVER_ERROR_MESSAGE, field: null });
    expect(JSON.stringify(error.getResponse())).not.toContain('token-secret');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toBe('register failed (Error)');
    expect(response.set).toEqual([]);
  });
});
