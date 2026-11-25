import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type AuthenticatedRequest, SessionGuard } from '../auth/session.guard';
import { TripError, TripsService, type TripSummary } from './trips.service';

/** JSON body for trip creation. Only `name` is read. Any owner or user ID is ignored (F2.R5). */
export interface CreateTripBody {
  name?: unknown;
}

/** Non-string input counts as empty, so the service reports the missing name. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Response body for one trip: `{ "trip": { id, name, createdAt } }` (F2 API table). */
export interface TripBody {
  trip: TripSummary;
}

/** Response body for the trip list: `{ "trips": [{ id, name, createdAt }] }`, newest first (F2 API table). */
export interface TripListBody {
  trips: TripSummary[];
}

/** Maps a trip service error to its status and the `{ error, field }` body. */
function toHttpException(error: TripError): HttpException {
  if (error.code === 'not_found') {
    return new HttpException({ error: error.code, field: null }, HttpStatus.NOT_FOUND);
  }
  return new HttpException({ error: error.code, field: 'name' }, HttpStatus.BAD_REQUEST);
}

/**
 * Runs a trip service call. Trip errors become HTTP errors. Anything else passes through
 * to Nest's error handler.
 */
async function withTripErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof TripError) {
      throw toHttpException(error);
    }
    throw error;
  }
}

/**
 * Trip routes. The class-level guard rejects requests with no valid session (F2.AC12),
 * so every route is guarded. The owner always comes from the session (F2.R5, F2.AC13).
 * There is no PUT or PATCH route, so names cannot change (F2.R10).
 */
@Controller('trips')
@UseGuards(SessionGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  /** Lists the signed-in user's trips, newest first (F2.AC6, F2.AC7). */
  @Get()
  async list(@Req() request: AuthenticatedRequest): Promise<TripListBody> {
    const trips = await this.trips.list(this.sessionUserId(request));
    return { trips };
  }

  /** Creates a trip owned by the signed-in user (F2.AC1, F2.AC3, F2.AC4, F2.AC13). */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateTripBody | undefined,
  ): Promise<TripBody> {
    const userId = this.sessionUserId(request);
    const trip = await withTripErrors(() => this.trips.create(userId, textOf(body?.name)));
    return { trip };
  }

  /** Returns one of the signed-in user's trips. Other users' trips give 404 (F2.AC11). */
  @Get(':id')
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<TripBody> {
    const userId = this.sessionUserId(request);
    const trip = await withTripErrors(() => this.trips.get(userId, id));
    return { trip };
  }

  /** Deletes one of the signed-in user's trips (F2.AC9, F2.AC11). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    const userId = this.sessionUserId(request);
    await withTripErrors(() => this.trips.delete(userId, id));
  }

  /** The guard sets userId on every request that reaches a handler. */
  private sessionUserId(request: AuthenticatedRequest): string {
    const userId = request.userId;
    if (userId === undefined) {
      throw new UnauthorizedException();
    }
    return userId;
  }
}
