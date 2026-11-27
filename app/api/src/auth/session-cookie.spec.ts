import { readSessionToken, sessionCookieOptions } from './session-cookie';

describe('session cookie options', () => {
  it('F1.AC14 cookie is HttpOnly with SameSite=Lax', () => {
    const options = sessionCookieOptions({});

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
  });

  it('F1.AC14 cookie has no Expires or Max-Age, so it ends when the browser closes', () => {
    const options = sessionCookieOptions({ NODE_ENV: 'production' });

    expect(options).not.toHaveProperty('expires');
    expect(options).not.toHaveProperty('maxAge');
    expect(options).not.toHaveProperty('Expires');
    expect(options).not.toHaveProperty('Max-Age');
  });

  it('F1.AC14 cookie is Secure when NODE_ENV is production', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production' }).secure).toBe(true);
  });

  it('F1.AC14 cookie is not Secure outside production', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'development' }).secure).toBe(false);
    expect(sessionCookieOptions({}).secure).toBe(false);
  });

  it('F1.AC14 cookie path is / so /api requests receive it', () => {
    expect(sessionCookieOptions({}).path).toBe('/');
  });
});

describe('readSessionToken', () => {
  it('F1.AC10 returns the session value from a Cookie header', () => {
    expect(readSessionToken('theme=dark; session=abc_DEF-123; other=1')).toBe('abc_DEF-123');
  });

  it('F1.AC10 returns null when there is no Cookie header', () => {
    expect(readSessionToken(undefined)).toBeNull();
  });

  it('F1.AC10 returns null when the session cookie is absent', () => {
    expect(readSessionToken('theme=dark; sessionid=abc')).toBeNull();
  });

  it('F1.AC10 returns null when the session cookie is empty', () => {
    expect(readSessionToken('session=; theme=dark')).toBeNull();
  });
});
