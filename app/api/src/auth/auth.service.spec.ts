import type { PasswordHasher } from './password-hasher';
import { AuthService, EMAIL_TAKEN_MESSAGE, LOGIN_FAILED_MESSAGE } from './auth.service';
import { hashToken } from './session-token';
import type { NewSession, SessionRepository } from './session.repository';
import {
  DuplicateEmailError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from './user.repository';

class FakeUserRepository implements UserRepository {
  readonly users: UserRecord[] = [];
  /** When true, create throws DuplicateEmailError even if findByEmail found nothing (a race). */
  raceOnCreate = false;
  private nextId = 1;

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async create(user: NewUser): Promise<UserRecord> {
    if (this.raceOnCreate || this.users.some((u) => u.email === user.email)) {
      throw new DuplicateEmailError();
    }
    const record: UserRecord = { id: `user-${this.nextId++}`, ...user };
    this.users.push(record);
    return record;
  }
}

class FakeSessionRepository implements SessionRepository {
  readonly sessions: NewSession[] = [];

  async create(session: NewSession): Promise<void> {
    this.sessions.push(session);
  }
}

/** Fake hasher: the "hash" is base64 text, so it differs from the password and does not contain it. */
class FakePasswordHasher implements PasswordHasher {
  private encode(password: string): string {
    return `fake:${Buffer.from(password, 'utf8').toString('base64')}`;
  }

  async hash(password: string): Promise<string> {
    return this.encode(password);
  }

  async verify(password: string, stored: string): Promise<boolean> {
    return stored === this.encode(password);
  }
}

describe('AuthService', () => {
  let users: FakeUserRepository;
  let sessions: FakeSessionRepository;
  let service: AuthService;

  beforeEach(() => {
    users = new FakeUserRepository();
    sessions = new FakeSessionRepository();
    service = new AuthService(users, sessions, new FakePasswordHasher());
  });

  describe('register', () => {
    it('F1.AC1 saves the new account, returns the user and a session token', async () => {
      const result = await service.register('Sam@Example.com', 'password1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(users.users).toHaveLength(1);
      expect(result.user).toEqual({ id: users.users[0].id, email: 'sam@example.com' });
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('F1.AC2 duplicate email saves nothing and returns the duplicate message', async () => {
      await service.register('sam@example.com', 'password1');
      const savedBefore = users.users.length;
      const sessionsBefore = sessions.sessions.length;

      const result = await service.register('sam@example.com', 'another-pass');

      expect(result).toEqual({ ok: false, error: 'This email is already registered.', field: 'email' });
      expect(users.users).toHaveLength(savedBefore);
      expect(sessions.sessions).toHaveLength(sessionsBefore);
    });

    it('F1.AC2 duplicate found at save time (sign-up race) returns the duplicate message', async () => {
      users.raceOnCreate = true;

      const result = await service.register('sam@example.com', 'password1');

      expect(result).toEqual({ ok: false, error: EMAIL_TAKEN_MESSAGE, field: 'email' });
      expect(users.users).toHaveLength(0);
      expect(sessions.sessions).toHaveLength(0);
    });

    it('F1.AC6 saved password is a hash, not the typed password', async () => {
      await service.register('sam@example.com', 'password1');

      const saved = users.users[0];
      expect(saved.passwordHash).not.toBe('password1');
      expect(saved.passwordHash).not.toContain('password1');
      expect(saved.passwordHash).toBe('fake:cGFzc3dvcmQx');
    });

    it('F1.AC1 creates a session whose stored value is the hash of the returned token', async () => {
      const result = await service.register('sam@example.com', 'password1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(sessions.sessions).toEqual([
        { userId: users.users[0].id, tokenHash: hashToken(result.token) },
      ]);
      expect(sessions.sessions[0].tokenHash).not.toBe(result.token);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register('sam@example.com', 'password1');
      sessions.sessions.length = 0;
    });

    it('F1.AC7 correct email and password create a session and return the user and token', async () => {
      const result = await service.login(' SAM@example.com ', 'password1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.user).toEqual({ id: users.users[0].id, email: 'sam@example.com' });
      expect(sessions.sessions).toEqual([
        { userId: users.users[0].id, tokenHash: hashToken(result.token) },
      ]);
    });

    it('F1.AC8 wrong password returns the generic message and creates no session', async () => {
      const result = await service.login('sam@example.com', 'wrong-password');

      expect(result).toEqual({ ok: false, error: LOGIN_FAILED_MESSAGE, field: null });
      expect(sessions.sessions).toHaveLength(0);
    });

    it('F1.AC8 unknown email returns the same generic message and creates no session', async () => {
      const wrongPassword = await service.login('sam@example.com', 'wrong-password');
      const unknownEmail = await service.login('nobody@example.com', 'password1');

      expect(unknownEmail).toEqual(wrongPassword);
      expect(unknownEmail).toEqual({ ok: false, error: LOGIN_FAILED_MESSAGE, field: null });
      expect(sessions.sessions).toHaveLength(0);
    });
  });
});
