import { Logger } from '@nestjs/common';

/** Account events the auth service logs (F1.R12). */
export type AuthEvent = 'register' | 'login' | 'login_failed' | 'logout' | 'delete_account';

/**
 * Port for auth logging. Callers pass only the event and, when known, the user ID.
 * Never pass a password, token, token hash or email.
 */
export interface AuthLogger {
  log(event: AuthEvent, userId?: string): void;
}

/** Adapter that writes auth events through the Nest Logger. */
export class NestAuthLogger implements AuthLogger {
  private readonly logger = new Logger('Auth');

  log(event: AuthEvent, userId?: string): void {
    this.logger.log(userId === undefined ? event : `${event} userId=${userId}`);
  }
}
