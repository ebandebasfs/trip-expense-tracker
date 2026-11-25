import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NestTripLogger } from './trip-logger';
import { PrismaTripRepository } from './prisma-trip.repository';
import { TripsController } from './trips.controller';
import { TRIP_LOGGER, TRIP_REPOSITORY } from './trips.tokens';
import { TripsService } from './trips.service';

// PrismaService and SessionGuard come from AuthModule, so the app keeps one PrismaService.
@Module({
  imports: [AuthModule],
  controllers: [TripsController],
  providers: [
    { provide: TRIP_REPOSITORY, useClass: PrismaTripRepository },
    { provide: TRIP_LOGGER, useClass: NestTripLogger },
    TripsService,
  ],
})
export class TripsModule {}
