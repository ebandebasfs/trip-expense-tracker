import { checkPassword, isValidEmail, normalizeEmail } from '../domain/account-rules';
import type { PasswordHasher } from './password-hasher';
import { createSessionToken, hashToken } from './session-token';
import { DuplicateEmailError, type UserRepository } from './user.repository';
import type { SessionRepository } from './session.repository';
import type { UnitOfWork } from './unit-of-work';

export const EMAIL_EMPTY_MESSAGE = 'Enter your email address.';
export const EMAIL_INVALID_MESSAGE = 'Enter a valid email address, such as name@example.com.';
export const EMAIL_TAKEN_MESSAGE = 'This email is already registered.';
export const LOGIN_EMPTY_MESSAGE = 'Enter your email and password.';
export const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';
export const DELETE_PASSWORD_WRONG_MESSAGE = 'Password is incorrect. Your account was not deleted.';

export interface DeleteAccountSuccess {
  ok: true;
}

export type DeleteAccountResult = DeleteAccountSuccess | AuthFailure;

export type AuthField = 'email' | 'password' | null;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSuccess {
  ok: true;
  user: AuthUser;
  /** The session token for the cookie. Only its hash is stored. */
  token: string;
}

export interface AuthFailure {
  ok: false;
  error: string;
  field: AuthField;
}

export type AuthResult = AuthSuccess | AuthFailure;

function fail(error: string, field: AuthField): AuthFailure {
  return { ok: false, error, field };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Registers a new account and logs it in (F1.R1, R2, R3, R5, R6). */
  async register(email: string, password: string): Promise<AuthResult> {
    const normalized = normalizeEmail(email);
    if (normalized === '') {
      return fail(EMAIL_EMPTY_MESSAGE, 'email');
    }
    if (!isValidEmail(normalized)) {
      return fail(EMAIL_INVALID_MESSAGE, 'email');
    }
    const passwordError = checkPassword(password);
    if (passwordError !== null) {
      return fail(passwordError, 'password');
    }

    if ((await this.users.findByEmail(normalized)) !== null) {
      return fail(EMAIL_TAKEN_MESSAGE, 'email');
    }

    const passwordHash = await this.hasher.hash(password);
    try {
      const user = await this.users.create({ email: normalized, passwordHash });
      return this.startSession(user.id, user.email);
    } catch (error) {
      // Two sign-ups with the same email at once: the unique rule blocks the second.
      if (error instanceof DuplicateEmailError) {
        return fail(EMAIL_TAKEN_MESSAGE, 'email');
      }
      throw error;
    }
  }

  /** Checks the email and password and starts a session (F1.R7, R8). */
  async login(email: string, password: string): Promise<AuthResult> {
    const normalized = normalizeEmail(email);
    if (normalized === '' || password === '') {
      return fail(LOGIN_EMPTY_MESSAGE, null);
    }
    if (!isValidEmail(normalized)) {
      return fail(EMAIL_INVALID_MESSAGE, 'email');
    }

    const user = await this.users.findByEmail(normalized);
    if (user === null) {
      return fail(LOGIN_FAILED_MESSAGE, null);
    }
    const matches = await this.hasher.verify(password, user.passwordHash);
    if (!matches) {
      return fail(LOGIN_FAILED_MESSAGE, null);
    }
    return this.startSession(user.id, user.email);
  }

  /** Ends the session for this token on the server (F1.R9). Only the token hash is looked up. */
  async logout(token: string): Promise<void> {
    await this.unitOfWork.deleteSessionByTokenHash(hashToken(token));
  }

  /**
   * Deletes the account after the password is checked (F1.R11). A wrong password
   * deletes nothing. Sessions and all other data go through database cascades.
   */
  async deleteAccount(userId: string, password: string): Promise<DeleteAccountResult> {
    const user = await this.unitOfWork.findUserById(userId);
    if (user === null) {
      return fail(DELETE_PASSWORD_WRONG_MESSAGE, 'password');
    }
    const matches = await this.hasher.verify(password, user.passwordHash);
    if (!matches) {
      return fail(DELETE_PASSWORD_WRONG_MESSAGE, 'password');
    }
    await this.unitOfWork.deleteUser(user.id);
    return { ok: true };
  }

  private async startSession(userId: string, email: string): Promise<AuthSuccess> {
    const token = createSessionToken();
    await this.sessions.create({ userId, tokenHash: hashToken(token) });
    return { ok: true, user: { id: userId, email }, token };
  }
}
