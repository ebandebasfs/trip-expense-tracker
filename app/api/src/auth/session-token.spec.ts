import { createSessionToken, hashToken } from './session-token';

describe('session token helpers', () => {
  it('F1.AC9 createSessionToken returns 32 random bytes as base64url', () => {
    const token = createSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url').length).toBe(32);
  });

  it('F1.AC9 createSessionToken returns a different token each call', () => {
    expect(createSessionToken()).not.toBe(createSessionToken());
  });

  it('F1.AC9 stored token is a SHA-256 hex hash, not the token itself', () => {
    const token = createSessionToken();
    const stored = hashToken(token);

    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toBe(token);
  });

  it('F1.AC9 hashToken is deterministic for the same token', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
