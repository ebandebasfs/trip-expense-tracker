'use client';

import { useEffect, useState } from 'react';
import { NewTripForm } from '../../components/new-trip-form';
import { TripList } from '../../components/trip-list';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient, type Trip } from '../../lib/api-client';

/** Trips page (F2): the create form above the visitor's trips. A logged-out visitor is sent to Log in by the client. */
export default function TripsPage() {
  // Null until the list has loaded.
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient.listTrips().then(
      (loaded) => setTrips(loaded),
      (error: unknown) => {
        // A session-expired 401 is already redirecting to Log in, so no message is shown.
        if (error instanceof ApiError && error.sessionExpired) {
          return;
        }
        setFailed(true);
      },
    );
  }, []);

  return (
    <main>
      <h1>Trips</h1>
      <NewTripForm
        createTrip={(name) => apiClient.createTrip(name)}
        onCreated={(trip) => setTrips((current) => (current === null ? null : [trip, ...current]))}
      />
      {failed ? (
        <p role="alert">{GENERIC_ERROR_MESSAGE}</p>
      ) : (
        <TripList
          trips={trips}
          deleteTrip={(id) => apiClient.deleteTrip(id)}
          onDeleted={(id) => setTrips((current) => current?.filter((trip) => trip.id !== id) ?? null)}
        />
      )}
    </main>
  );
}
