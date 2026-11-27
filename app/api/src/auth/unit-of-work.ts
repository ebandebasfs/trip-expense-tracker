import type { UserRecord } from './user.repository';

/**
 * Session and account operations used by logout and account deletion.
 * They sit here, not on the repository ports, so the register and login ports stay as they are.
 */
export interface UnitOfWork {
  /** Deletes the session row with this token hash. Does nothing when no row matches. */
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  /** Finds a user by id. Returns null when there is none. */
  findUserById(userId: string): Promise<UserRecord | null>;
  /**
   * Deletes the user in one transaction. Database cascades remove the user's sessions
   * and, once they exist, their trips, people, expenses and payments.
   */
  deleteUser(userId: string): Promise<void>;
}
