import {
  checkPassword,
  isValidEmail,
  normalizeEmail,
  PASSWORD_EMPTY_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from './account-rules';

describe('account rules', () => {
  describe('email normalization and format', () => {
    it('F1.AC3 trims and lowercases " Sam@Example.COM " to "sam@example.com"', () => {
      expect(normalizeEmail(' Sam@Example.COM ')).toBe('sam@example.com');
    });

    it('F1.AC4 accepts a normal email address', () => {
      expect(isValidEmail('sam@example.com')).toBe(true);
    });

    it('F1.AC4 rejects an email without an @', () => {
      expect(isValidEmail('sam.example.com')).toBe(false);
    });

    it('F1.AC4 rejects an email with two @ signs', () => {
      expect(isValidEmail('sam@@example.com')).toBe(false);
      expect(isValidEmail('a@b@example.com')).toBe(false);
    });

    it('F1.AC4 rejects a domain without a dot', () => {
      expect(isValidEmail('sam@example')).toBe(false);
    });

    it('F1.AC4 rejects a dot with no text on one side in the domain', () => {
      expect(isValidEmail('sam@.com')).toBe(false);
      expect(isValidEmail('sam@example.')).toBe(false);
      expect(isValidEmail('sam@example..com')).toBe(false);
    });

    it('F1.AC4 rejects an empty local part', () => {
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('F1.AC4 rejects an empty domain', () => {
      expect(isValidEmail('sam@')).toBe(false);
    });

    it('F1.AC4 rejects an empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('password length', () => {
    const repeat = (char: string, count: number) => char.repeat(count);

    it('F1.AC5 rejects a 7-character password with the too-short message', () => {
      expect(checkPassword(repeat('a', 7))).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    });

    it('F1.AC5 accepts an 8-character password', () => {
      expect(checkPassword(repeat('a', 8))).toBeNull();
    });

    it('F1.AC5 accepts a 128-character password', () => {
      expect(checkPassword(repeat('a', 128))).toBeNull();
    });

    it('F1.AC5 rejects a 129-character password with the too-long message', () => {
      expect(checkPassword(repeat('a', 129))).toBe(PASSWORD_TOO_LONG_MESSAGE);
    });

    it('F1.AC5 rejects an empty password with the empty message', () => {
      expect(checkPassword('')).toBe(PASSWORD_EMPTY_MESSAGE);
    });

    it('F1.AC5 counts characters, not bytes: 8 emoji are accepted', () => {
      // Each emoji is 4 bytes in UTF-8 but one code point.
      expect(checkPassword('😀'.repeat(8))).toBeNull();
    });

    it('F1.AC5 counts characters, not bytes: 7 emoji are rejected', () => {
      expect(checkPassword('😀'.repeat(7))).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    });

    it('F1.AC5 does not trim: leading and trailing spaces count toward the length', () => {
      // 8 characters including the spaces: accepted, so the spaces were not trimmed away.
      expect(checkPassword(' ' + 'a'.repeat(6) + ' ')).toBeNull();
      // 7 characters including the spaces: rejected.
      expect(checkPassword(' ' + 'a'.repeat(5) + ' ')).toBe(PASSWORD_TOO_SHORT_MESSAGE);
      expect(checkPassword(' '.repeat(7))).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    });
  });
});
