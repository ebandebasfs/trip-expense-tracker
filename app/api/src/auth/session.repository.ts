export interface NewSession {
  userId: string;
  /** SHA-256 hex of the session token. The token itself is never stored. */
  tokenHash: string;
}

export interface SessionRepository {
  /** Saves a new session row for a user. */
  create(session: NewSession): Promise<void>;
  /** Returns the user ID that owns the session with this token hash, or null when there is none. */
  findUserIdByTokenHash(tokenHash: string): Promise<string | null>;
}
