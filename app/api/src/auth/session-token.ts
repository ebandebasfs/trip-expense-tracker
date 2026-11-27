import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/** Returns a new random session token: 32 bytes encoded as base64url. */
export function createSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Returns the SHA-256 hex digest of a token. Only this digest is stored. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
