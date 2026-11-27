import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hashToken } from './session-token';
import { SESSION_REPOSITORY } from './auth.tokens';
import { readSessionToken } from './session-cookie';
import type { SessionRepository } from './session.repository';

/** Request shape after the guard has run. */
export interface AuthenticatedRequest {
  headers: { cookie?: string };
  userId?: string;
}

/**
 * Rejects requests with no valid session (F1.R10). On success it sets `userId` on the
 * request. Ownership of each trip is checked in the trip queries (F2 onward).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request.headers.cookie);
    if (token === null) {
      throw new UnauthorizedException();
    }
    const userId = await this.sessions.findUserIdByTokenHash(hashToken(token));
    if (userId === null) {
      throw new UnauthorizedException();
    }
    request.userId = userId;
    return true;
  }
}
