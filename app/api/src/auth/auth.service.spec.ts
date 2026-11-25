import type { AuthEvent, AuthLogger } from './auth-logger';
import type { PasswordHasher } from './password-hasher';
import {
  AuthService,
  DELETE_PASSWORD_EMPTY_MESSAGE,
  DELETE_PASSWORD_WRONG_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  LOGIN_FAILED_MESSAGE,
} from './auth.service';
import { hashToken } from './session-token';
import type { NewSession, SessionRepository } from './session.repository';
import type { UnitOfWork } from './unit-of-work';
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

  async findUserIdByTokenHash(tokenHash: string): Promise<string | null> {
    return this.sessions.find((s) => s.tokenHash === tokenHash)?.userId ?? null;
  }
}

/** Removes every item that matches, in place, so the fake arrays keep their identity. */
function removeWhere<T>(items: T[], matches: (item: T) => boolean): void {
  for (let i = items.length - 1; i >= 0; i--) {
    if (matches(items[i])) items.splice(i, 1);
  }
}

/**
 * Fake unit of work over the fake user and session stores. Deleting a user also drops
 * their sessions, as the Session foreign key does in the database. The real cascade is checked in code review.
 */
class FakeUnitOfWork implements UnitOfWork {
  constructor(
    private readonly users: FakeUserRepository,
    private readonly sessions: FakeSessionRepository,
  ) {}

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    removeWhere(this.sessions.sessions, (s) => s.tokenHash === tokenHash);
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    return this.users.users.find((user) => user.id === userId) ?? null;
  }

  async deleteUser(userId: string): Promise<void> {
    removeWhere(this.users.users, (user) => user.id === userId);
    removeWhere(this.sessions.sessions, (s) => s.userId === userId);
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

/** Fake logger that records every call so tests can check what was logged. */
class FakeAuthLogger implements AuthLogger {
  readonly calls: { event: AuthEvent; userId?: string }[] = [];

  log(event: AuthEvent, userId?: string): void {
    this.calls.push({ event, userId });
  }
}

describe('AuthService', () => {
  let users: FakeUserRepository;
  let sessions: FakeSessionRepository;
  let logger: FakeAuthLogger;
  let service: AuthService;

  beforeEach(() => {
    users = new FakeUserRepository();
    sessions = new FakeSessionRepository();
    logger = new FakeAuthLogger();
    service = new AuthService(
      users,
      sessions,
      new FakePasswordHasher(),
      new FakeUnitOfWork(users, sessions),
      logger,
    );
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

  describe('logout', () => {
    it('F1.AC9 ends the session for the token, so the old token finds no session', async () => {
      const first = await service.register('sam@example.com', 'password1');
      const second = await service.login('sam@example.com', 'password1');
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;

      await service.logout(first.token);

      expect(sessions.sessions).toEqual([
        { userId: users.users[0].id, tokenHash: hashToken(second.token) },
      ]);
      expect(sessions.sessions.some((s) => s.tokenHash === hashToken(first.token))).toBe(false);
    });

    it('F1.AC9 logging out with a token that has no session changes nothing', async () => {
      await service.register('sam@example.com', 'password1');
      const before = [...sessions.sessions];

      await service.logout('unknown-token');

      expect(sessions.sessions).toEqual(before);
    });
  });

  describe('deleteAccount', () => {
    let userId: string;
    let token: string;

    beforeEach(async () => {
      const result = await service.register('sam@example.com', 'password1');
      if (!result.ok) throw new Error('setup failed');
      userId = result.user.id;
      token = result.token;
    });

    it('F1.AC12 wrong password returns the message and deletes no user or session', async () => {
      const usersBefore = [...users.users];
      const sessionsBefore = [...sessions.sessions];

      const result = await service.deleteAccount(userId, 'wrong-password');

      expect(result).toEqual({
        ok: false,
        error: DELETE_PASSWORD_WRONG_MESSAGE,
        field: 'password',
      });
      expect(users.users).toEqual(usersBefore);
      expect(sessions.sessions).toEqual(sessionsBefore);
      expect(sessions.sessions.some((s) => s.tokenHash === hashToken(token))).toBe(true);
    });

    it('F1.AC12 unknown user id returns the same message and deletes nothing', async () => {
      const sessionsBefore = [...sessions.sessions];

      const result = await service.deleteAccount('no-such-user', 'password1');

      expect(result).toEqual({
        ok: false,
        error: DELETE_PASSWORD_WRONG_MESSAGE,
        field: 'password',
      });
      expect(users.users).toHaveLength(1);
      expect(sessions.sessions).toEqual(sessionsBefore);
    });

    it('F1.AC12 correct password deletes the user and ends their sessions', async () => {
      const result = await service.deleteAccount(userId, 'password1');

      expect(result).toEqual({ ok: true });
      expect(users.users).toHaveLength(0);
      expect(sessions.sessions).toHaveLength(0);
    });

    it('F1.AC12 empty password returns the empty-password message and deletes nothing', async () => {
      const usersBefore = [...users.users];
      const sessionsBefore = [...sessions.sessions];

      const result = await service.deleteAccount(userId, '');

      expect(result).toEqual({
        ok: false,
        error: DELETE_PASSWORD_EMPTY_MESSAGE,
        field: 'password',
      });
      expect(DELETE_PASSWORD_EMPTY_MESSAGE).toBe('Enter your password to delete your account.');
      expect(users.users).toEqual(usersBefore);
      expect(sessions.sessions).toEqual(sessionsBefore);
    });
  });

  describe('currentUser', () => {
    it('F1.AC10 returns only the id and email of an existing user, never the password hash', async () => {
      const registered = await service.register('sam@example.com', 'password1');
      if (!registered.ok) throw new Error('setup failed');

      const user = await service.currentUser(registered.user.id);

      expect(user).toEqual({ id: registered.user.id, email: 'sam@example.com' });
      expect(JSON.stringify(user)).not.toContain(users.users[0].passwordHash);
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('F1.AC10 returns null when the user no longer exists', async () => {
      const registered = await service.register('sam@example.com', 'password1');
      if (!registered.ok) throw new Error('setup failed');
      await service.deleteAccount(registered.user.id, 'password1');

      await expect(service.currentUser(registered.user.id)).resolves.toBeNull();
    });

    it('F1.AC10 returns null for an unknown user id', async () => {
      await expect(service.currentUser('no-such-user')).resolves.toBeNull();
    });
  });

  describe('logging', () => {
    const PASSWORD = 'password1';
    const WRONG_PASSWORD = 'wrong-password';
    const EMAIL = 'sam@example.com';

    it('F1.AC15 logs each account event with the user ID only', async () => {
      const registered = await service.register(EMAIL, PASSWORD);
      expect(registered.ok).toBe(true);
      await service.login(EMAIL, PASSWORD);
      await service.login(EMAIL, WRONG_PASSWORD);
      await service.login('nobody@example.com', PASSWORD);
      if (!registered.ok) return;
      await service.logout(registered.token);
      await service.deleteAccount(registered.user.id, PASSWORD);

      expect(logger.calls).toEqual([
        { event: 'register', userId: 'user-1' },
        { event: 'login', userId: 'user-1' },
        { event: 'login_failed', userId: 'user-1' },
        { event: 'login_failed' },
        { event: 'logout' },
        { event: 'delete_account', userId: 'user-1' },
      ]);
    });

    it('F1.AC15 no password, session token, token hash or email appears in any logged call', async () => {
      const registered = await service.register(EMAIL, PASSWORD);
      if (!registered.ok) throw new Error('setup failed');
      const loggedIn = await service.login(EMAIL, PASSWORD);
      if (!loggedIn.ok) throw new Error('setup failed');
      const storedHash = users.users[0].passwordHash;
      await service.login(EMAIL, WRONG_PASSWORD);
      await service.logout(registered.token);
      await service.deleteAccount(registered.user.id, PASSWORD);

      const logged = JSON.stringify(logger.calls);
      const secrets = [
        PASSWORD,
        WRONG_PASSWORD,
        EMAIL,
        registered.token,
        loggedIn.token,
        hashToken(registered.token),
        hashToken(loggedIn.token),
        storedHash,
      ];
      for (const secret of secrets) {
        expect(logged).not.toContain(secret);
      }
      expect(logger.calls.length).toBeGreaterThan(0);
    });

    it('F1.AC15 failed delete with a wrong or empty password logs nothing', async () => {
      const registered = await service.register(EMAIL, PASSWORD);
      if (!registered.ok) throw new Error('setup failed');
      logger.calls.length = 0;

      await service.deleteAccount(registered.user.id, WRONG_PASSWORD);
      await service.deleteAccount(registered.user.id, '');

      expect(logger.calls).toEqual([]);
    });
  });
});
