export interface NewSession {
  userId: string;
  /** SHA-256 hex of the session token. The token itself is never stored. */
  tokenHash: string;
}

export interface SessionRepository {
  /** Saves a new session row for a user. */
  create(session: NewSession): Promise<void>;
}
