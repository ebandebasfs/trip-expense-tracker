export const TRIP_NAME_MAX_LENGTH = 100;

export type TripNameError = 'name_required' | 'name_too_long';

/** Trims leading and trailing spaces before a trip name is checked or saved (F2.R1). */
export function normalizeTripName(name: string): string {
  return name.trim();
}

/**
 * Checks a trip name (F2.R2). Callers pass the raw name.
 * The name is trimmed first. Length counts Unicode code points.
 * Returns the error code, or null when the name is accepted.
 */
export function checkTripName(name: string): TripNameError | null {
  const trimmed = normalizeTripName(name);
  if (trimmed.length === 0) {
    return 'name_required';
  }
  if ([...trimmed].length > TRIP_NAME_MAX_LENGTH) {
    return 'name_too_long';
  }
  return null;
}

/**
 * Returns a copy of the trips ordered by creation time, newest first,
 * with ties broken by ID, descending (F2.R6).
 */
export function sortNewestFirst<T extends { id: string; createdAt: Date }>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => {
    const byTime = b.createdAt.getTime() - a.createdAt.getTime();
    if (byTime !== 0) {
      return byTime;
    }
    if (a.id === b.id) {
      return 0;
    }
    return a.id < b.id ? 1 : -1;
  });
}
