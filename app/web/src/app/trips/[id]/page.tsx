'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { buttonVariants } from '../../../components/ui/button';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient, type Trip } from '../../../lib/api-client';

const TRIP_NOT_FOUND_MESSAGE = 'This trip could not be found.';
const BACK_TO_TRIPS_LABEL = 'Back to trips';

/**
 * Trip page (F2.R9). Shows the trip name only. A missing trip and another user's trip both get the
 * same not-found message. A logged-out visitor is sent to Log in by the route rules (F1.T11).
 */
export default function TripPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // Null until the trip has loaded.
  const [trip, setTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setTrip(null);
    setNotFound(false);
    setFailed(false);

    apiClient.getTrip(id).then(
      (loaded) => {
        if (active) setTrip(loaded);
      },
      (error: unknown) => {
        if (!active) return;
        // A session-expired 401 is already redirecting to Log in, so no message is shown.
        if (error instanceof ApiError && error.sessionExpired) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true);
          return;
        }
        setFailed(true);
      },
    );

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-6">
          {notFound ? (
            <p role="alert" className="text-sm text-destructive">
              {TRIP_NOT_FOUND_MESSAGE}
            </p>
          ) : failed ? (
            <p role="alert" className="text-sm text-destructive">
              {GENERIC_ERROR_MESSAGE}
            </p>
          ) : trip !== null ? (
            <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
          ) : null}
          <p>
            <Link href="/trips" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {BACK_TO_TRIPS_LABEL}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
