/**
 * Injection tokens for the trips providers. They live in their own file so that
 * `trips.module.ts` and `trips.service.ts` can both import them without importing each other.
 */

/** Injection token for the TripRepository port. */
export const TRIP_REPOSITORY = Symbol('TRIP_REPOSITORY');
/** Injection token for the TripLogger port. */
export const TRIP_LOGGER = Symbol('TRIP_LOGGER');
