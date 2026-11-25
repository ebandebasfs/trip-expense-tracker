import { Inject, Injectable } from '@nestjs/common';
import { checkTripName, normalizeTripName, sortNewestFirst, type TripNameError } from '../domain/trip-rules';
import type { TripLogger } from './trip-logger';
import type { TripRecord, TripRepository } from './trip.repository';
import { TRIP_LOGGER, TRIP_REPOSITORY } from './trips.tokens';

/** Error codes the trips service throws. `not_found` covers both missing and other users' trips (F2.R9). */
export type TripErrorCode = TripNameError | 'not_found';

/** Thrown by TripsService with the code the API maps to a response. */
export class TripError extends Error {
  readonly code: TripErrorCode;

  constructor(code: TripErrorCode) {
    super(code);
    this.name = 'TripError';
    this.code = code;
  }
}

/** The trip fields the API returns. The owner is never included (F2.R6). */
export interface TripSummary {
  id: string;
  name: string;
  createdAt: Date;
}

function toSummary(trip: TripRecord): TripSummary {
  return { id: trip.id, name: trip.name, createdAt: trip.createdAt };
}

@Injectable()
export class TripsService {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_LOGGER) private readonly logger: TripLogger,
  ) {}

  /** Saves a trip owned by the session user (F2.R1, R2, R3, R5). Throws TripError on an invalid name. */
  async create(userId: string, name: string): Promise<TripSummary> {
    const nameError = checkTripName(name);
    if (nameError !== null) {
      throw new TripError(nameError);
    }
    const trip = await this.trips.create(userId, normalizeTripName(name));
    this.logger.log({ action: 'create', userId, tripId: trip.id });
    return toSummary(trip);
  }

  /** Lists the session user's trips, newest first, with id, name and createdAt only (F2.R6). */
  async list(userId: string): Promise<TripSummary[]> {
    const trips = await this.trips.listByOwner(userId);
    this.logger.log({ action: 'list', userId });
    return sortNewestFirst(trips).map(toSummary);
  }

  /** Returns one of the session user's trips. Throws not_found otherwise (F2.R9). */
  async get(userId: string, id: string): Promise<TripSummary> {
    const trip = await this.trips.findByIdForOwner(userId, id);
    if (trip === null) {
      this.logger.log({ action: 'not_found', userId, tripId: id });
      throw new TripError('not_found');
    }
    return toSummary(trip);
  }

  /** Deletes one of the session user's trips. Throws not_found when nothing was removed (F2.R7, R9). */
  async delete(userId: string, id: string): Promise<void> {
    const removed = await this.trips.deleteForOwner(userId, id);
    if (!removed) {
      this.logger.log({ action: 'not_found', userId, tripId: id });
      throw new TripError('not_found');
    }
    this.logger.log({ action: 'delete', userId, tripId: id });
  }
}
