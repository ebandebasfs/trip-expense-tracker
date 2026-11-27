import { Injectable, Logger } from '@nestjs/common';

/**
 * A trip event the service logs. It carries IDs only: no trip name and no session token (F2.AC15).
 * `tripId` is absent for list events.
 */
export interface TripLogEvent {
  action: 'create' | 'list' | 'not_found' | 'delete';
  userId: string;
  tripId?: string;
}

/** Port the trips service logs through. The Nest adapter is NestTripLogger. */
export interface TripLogger {
  log(event: TripLogEvent): void;
}

/** Writes trip events at info level through the Nest Logger. */
@Injectable()
export class NestTripLogger implements TripLogger {
  private readonly logger = new Logger('Trips');

  log(event: TripLogEvent): void {
    const tripPart = event.tripId === undefined ? '' : ` tripId=${event.tripId}`;
    this.logger.log(`trip.${event.action} userId=${event.userId}${tripPart}`);
  }
}
