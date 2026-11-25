// Client-side checks for fast feedback (F2 spec, trip names). They mirror the API rules in
// app/api/src/domain/trip-rules.ts. The server result always wins.

import type { ValidationError } from './validation';

export const TRIP_NAME_EMPTY_MESSAGE = 'Enter a trip name.';
export const TRIP_NAME_TOO_LONG_MESSAGE = 'Trip names can be up to 100 characters.';

export const TRIP_NAME_MAX_LENGTH = 100;

/** Trims leading and trailing spaces, as the API does before it checks or saves the name (F2.R2). */
export function normalizeTripName(name: string): string {
  return name.trim();
}

/**
 * First problem with a trip name (F2.R2), or null. The name is trimmed first.
 * Length counts Unicode code points, not UTF-16 units.
 */
export function validateTripName(name: string): ValidationError | null {
  const normalized = normalizeTripName(name);
  if (normalized.length === 0) {
    return { field: 'name', message: TRIP_NAME_EMPTY_MESSAGE };
  }
  if ([...normalized].length > TRIP_NAME_MAX_LENGTH) {
    return { field: 'name', message: TRIP_NAME_TOO_LONG_MESSAGE };
  }
  return null;
}
