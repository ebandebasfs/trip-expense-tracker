export interface TripRecord {
  id: string;
  userId: string;
  name: string;
  /** UTC, set on insert. */
  createdAt: Date;
}

export interface TripRepository {
  /** Saves a new trip owned by the user and returns it. */
  create(userId: string, name: string): Promise<TripRecord>;
  /** Returns the user's trips, newest first by createdAt. */
  listByOwner(userId: string): Promise<TripRecord[]>;
  /** Returns the trip only when it belongs to the user, or null otherwise. */
  findByIdForOwner(userId: string, id: string): Promise<TripRecord | null>;
  /** Removes the trip only when it belongs to the user. Returns true when a row was removed. */
  deleteForOwner(userId: string, id: string): Promise<boolean>;
}
