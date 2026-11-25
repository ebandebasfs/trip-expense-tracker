import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AuthService,
  DELETE_PASSWORD_WRONG_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  LOGIN_FAILED_MESSAGE,
  type AuthFailure,
  type AuthUser,
} from './auth.service';
import {
  readSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  type SessionCookieOptions,
} from './session-cookie';
import { SessionGuard, type AuthenticatedRequest } from './session.guard';

/** Message for any unexpected failure. It never carries error details (F1.R12). */
export const SERVER_ERROR_MESSAGE = 'Something went wrong. Try again.';

/** JSON body for register and login. Fields are checked by the service. */
export interface CredentialsBody {
  email?: unknown;
  password?: unknown;
}

/** JSON body for account deletion. */
export interface DeleteAccountBody {
  password?: unknown;
}

/** The parts of the Express request the controller reads. */
export interface CookieRequest {
  headers: { cookie?: string };
}

/** The parts of the Express response the controller writes. */
export interface CookieResponse {
  cookie(name: string, value: string, options: SessionCookieOptions): void;
  clearCookie(name: string, options: SessionCookieOptions): void;
}

/** Non-string input counts as empty, so the service reports the missing field. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Maps a service failure to its status: 409 duplicate, 401 wrong credentials, else 400. */
function failureStatus(failure: AuthFailure): HttpStatus {
  switch (failure.error) {
    case EMAIL_TAKEN_MESSAGE:
      return HttpStatus.CONFLICT;
    case LOGIN_FAILED_MESSAGE:
    case DELETE_PASSWORD_WRONG_MESSAGE:
      return HttpStatus.UNAUTHORIZED;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}

function toHttpException(failure: AuthFailure): HttpException {
  return new HttpException({ error: failure.error, field: failure.field }, failureStatus(failure));
}

@Controller()
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(private readonly auth: AuthService) {}

  /** Registers and logs in the new user (F1.R6). */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: CredentialsBody | undefined,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthUser> {
    const result = await this.guarded('register', () =>
      this.auth.register(textOf(body?.email), textOf(body?.password)),
    );
    if (!result.ok) {
      throw toHttpException(result);
    }
    res.cookie(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
    return result.user;
  }

  /** Checks the credentials and starts a session (F1.R7, R8). */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: CredentialsBody | undefined,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthUser> {
    const result = await this.guarded('login', () =>
      this.auth.login(textOf(body?.email), textOf(body?.password)),
    );
    if (!result.ok) {
      throw toHttpException(result);
    }
    res.cookie(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
    return result.user;
  }

  /** Ends the session if there is one. Safe to call again (F1.R9). */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<void> {
    const token = readSessionToken(request.headers.cookie);
    if (token !== null) {
      await this.guarded('logout', () => this.auth.logout(token));
    }
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }

  /** Deletes the signed-in user's account after the password check (F1.R11). */
  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async deleteAccount(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeleteAccountBody | undefined,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<void> {
    // The guard sets userId on every request that reaches this handler.
    const userId = request.userId;
    if (userId === undefined) {
      throw new UnauthorizedException();
    }
    const result = await this.guarded('delete_account', () =>
      this.auth.deleteAccount(userId, textOf(body?.password)),
    );
    if (!result.ok) {
      throw toHttpException(result);
    }
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }

  /**
   * Runs a service call. HTTP errors pass through. Any other error becomes a generic 500.
   * Only the route name and the error type are logged, because the message can hold user data.
   */
  private async guarded<T>(route: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errorType = error instanceof Error ? error.name : 'non-Error value';
      this.logger.error(`${route} failed (${errorType})`);
      throw new InternalServerErrorException({ error: SERVER_ERROR_MESSAGE, field: null });
    }
  }
}
