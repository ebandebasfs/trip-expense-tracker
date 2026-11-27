import {
  EMAIL_EMPTY_MESSAGE,
  EMAIL_INVALID_MESSAGE,
  LOGIN_EMPTY_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  checkNewPassword,
  validateLogin,
  validateRegistration,
} from './validation';

describe('validation (client mirror of the API rules)', () => {
  it.each(['name.example.com', 'name@', '@example.com', 'name@example', 'name@.com', 'name@example.', 'a@b@example.com', 'name@example..com'])(
    'F1.AC4 registration rejects the email "%s" with the format message and no other check',
    (email) => {
      expect(validateRegistration(email, 'a-valid-password')).toEqual({
        field: 'email',
        message: EMAIL_INVALID_MESSAGE,
      });
    },
  );

  it.each(['name.example.com', 'name@', '@example.com', 'name@example'])(
    'F1.AC4 log in rejects the email "%s" with the format message',
    (email) => {
      expect(validateLogin(email, 'any-password')).toEqual({
        field: 'email',
        message: EMAIL_INVALID_MESSAGE,
      });
    },
  );

  it('F1.AC4 accepts a normal email, trimmed and in any case', () => {
    expect(validateRegistration('  Name@Example.com ', 'a-valid-password')).toBeNull();
    expect(validateLogin('name@example.co.uk', 'x')).toBeNull();
  });

  it('F1.AC4 an empty email on registration shows the empty message', () => {
    expect(validateRegistration('   ', 'a-valid-password')).toEqual({
      field: 'email',
      message: EMAIL_EMPTY_MESSAGE,
    });
  });

  it('F1.AC4 an empty email or password on log in shows the form message', () => {
    expect(validateLogin('', 'x')).toEqual({ field: null, message: LOGIN_EMPTY_MESSAGE });
    expect(validateLogin('name@example.com', '')).toEqual({ field: null, message: LOGIN_EMPTY_MESSAGE });
  });

  it('F1.AC5 rejects a 7-character password with the too-short message', () => {
    expect(checkNewPassword('a'.repeat(7))).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    expect(validateRegistration('name@example.com', 'a'.repeat(7))).toEqual({
      field: 'password',
      message: PASSWORD_TOO_SHORT_MESSAGE,
    });
  });

  it('F1.AC5 accepts an 8-character password', () => {
    expect(checkNewPassword('a'.repeat(8))).toBeNull();
    expect(validateRegistration('name@example.com', 'a'.repeat(8))).toBeNull();
  });

  it('F1.AC5 accepts a 128-character password', () => {
    expect(checkNewPassword('a'.repeat(128))).toBeNull();
  });

  it('F1.AC5 rejects a 129-character password with the too-long message', () => {
    expect(checkNewPassword('a'.repeat(129))).toBe(PASSWORD_TOO_LONG_MESSAGE);
    expect(validateRegistration('name@example.com', 'a'.repeat(129))).toEqual({
      field: 'password',
      message: PASSWORD_TOO_LONG_MESSAGE,
    });
  });

  it('F1.AC5 counts characters, not UTF-16 units', () => {
    // Each emoji is two UTF-16 units but one character. 8 emoji is accepted.
    expect(checkNewPassword('\u{1F600}'.repeat(8))).toBeNull();
    expect(checkNewPassword('\u{1F600}'.repeat(7))).toBe(PASSWORD_TOO_SHORT_MESSAGE);
  });

  it('F1.AC5 reports the email first when both fields are wrong', () => {
    expect(validateRegistration('bad', 'short')).toEqual({
      field: 'email',
      message: EMAIL_INVALID_MESSAGE,
    });
  });
});
