import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

const SALT_BYTES = 16;
const KEY_BYTES = 64;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

/**
 * Stores passwords as `salt:hash`, both in hex, using scrypt with a random
 * 16-byte salt. The plain password is never returned or kept.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split(':');
    if (parts.length !== 2) {
      throw new Error('Stored password hash has an invalid format');
    }
    const [saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) {
      throw new Error('Stored password hash has an invalid format');
    }
    const actual = await deriveKey(password, salt);
    return timingSafeEqual(actual, expected);
  }
}
