import { ScryptPasswordHasher } from './password-hasher';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();
  const password = 'correct horse battery staple';

  it('F1.AC6 stored password is a hash that differs from the typed password', async () => {
    const stored = await hasher.hash(password);

    expect(stored).not.toBe(password);
    expect(stored).not.toContain(password);
  });

  it('F1.AC6 stored value is salt:hash in hex with a 16-byte salt', async () => {
    const stored = await hasher.hash(password);

    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('F1.AC6 uses a new random salt, so the same password hashes differently', async () => {
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toBe(second);
  });

  it('F1.AC6 verify accepts the original password', async () => {
    const stored = await hasher.hash(password);

    await expect(hasher.verify(password, stored)).resolves.toBe(true);
  });

  it('F1.AC6 verify rejects a different password', async () => {
    const stored = await hasher.hash(password);

    await expect(hasher.verify('wrong password', stored)).resolves.toBe(false);
  });

  it('F1.AC6 verify throws on a malformed stored value', async () => {
    await expect(hasher.verify(password, 'not-a-hash')).rejects.toThrow(
      'Stored password hash has an invalid format',
    );
  });
});
