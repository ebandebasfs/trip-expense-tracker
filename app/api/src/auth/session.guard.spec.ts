import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionGuard, type AuthenticatedRequest } from './session.guard';
import type { NewSession, SessionRepository } from './session.repository';
import { hashToken } from './session-token';

class FakeSessionRepository implements SessionRepository {
  readonly lookups: string[] = [];
  /** Maps a token hash to the user ID that owns that session. */
  readonly userIdByTokenHash = new Map<string, string>();

  async create(session: NewSession): Promise<void> {
    this.userIdByTokenHash.set(session.tokenHash, session.userId);
  }

  async findUserIdByTokenHash(tokenHash: string): Promise<string | null> {
    this.lookups.push(tokenHash);
    return this.userIdByTokenHash.get(tokenHash) ?? null;
  }
}

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  let sessions: FakeSessionRepository;
  let guard: SessionGuard;

  beforeEach(async () => {
    sessions = new FakeSessionRepository();
    guard = new SessionGuard(sessions);
    await sessions.create({ userId: 'user-a', tokenHash: hashToken('token-a') });
  });

  it('F1.AC10 rejects a request with no Cookie header and does not look anything up', async () => {
    const request: AuthenticatedRequest = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.lookups).toEqual([]);
    expect(request.userId).toBeUndefined();
  });

  it('F1.AC10 rejects a request whose session cookie is absent', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: 'theme=dark' } };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.lookups).toEqual([]);
  });

  it('F1.AC10 rejects a request with an unknown session token', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: 'session=not-a-real-token' } };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.lookups).toEqual([hashToken('not-a-real-token')]);
    expect(request.userId).toBeUndefined();
  });

  it('F1.AC10 looks up the SHA-256 hash of the token, never the raw token', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-a' } };

    await guard.canActivate(contextFor(request));

    expect(sessions.lookups).toEqual([hashToken('token-a')]);
    expect(sessions.lookups).not.toContain('token-a');
  });

  it('F1.AC10 allows a request with a valid session and attaches its userId', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-a' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.userId).toBe('user-a');
  });

  it('F1.AC11 gives handlers the signed-in user ID so each trip query can check ownership', async () => {
    await sessions.create({ userId: 'user-b', tokenHash: hashToken('token-b') });
    const request: AuthenticatedRequest = { headers: { cookie: 'session=token-b' } };

    await guard.canActivate(contextFor(request));

    expect(request.userId).toBe('user-b');
  });
});
