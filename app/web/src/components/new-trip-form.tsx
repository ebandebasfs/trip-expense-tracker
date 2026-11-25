'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError, type Trip } from '../lib/api-client';
import {
  TRIP_NAME_EMPTY_MESSAGE,
  TRIP_NAME_TOO_LONG_MESSAGE,
  normalizeTripName,
  validateTripName,
} from '../lib/trip-validation';

export const TRIP_CREATED_MESSAGE = 'Trip created.';
export const CREATE_FAILED_MESSAGE = 'Could not create the trip. Try again.';

export interface NewTripFormProps {
  /** Rejects with an ApiError when the trip is not saved. */
  createTrip: (name: string) => Promise<Trip>;
  /** Called with the new trip once it is saved. */
  onCreated: (trip: Trip) => void;
}

/** Maps a server name error code to the same message the form shows for that check (F2.R2). */
function nameErrorMessage(code: string): string | null {
  if (code === 'name_required') {
    return TRIP_NAME_EMPTY_MESSAGE;
  }
  if (code === 'name_too_long') {
    return TRIP_NAME_TOO_LONG_MESSAGE;
  }
  return null;
}

/**
 * New trip form (F2 spec, Trips). Checks the name before any request. On success it clears the
 * field and reports the new trip. On failure it keeps the typed name.
 */
export function NewTripForm({ createTrip, onCreated }: NewTripFormProps) {
  const ids = useId();
  const nameId = `${ids}-name`;
  const errorId = `${ids}-error`;

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Guards against a second submit in the same tick, before the disabled button renders.
  const pendingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) {
      return;
    }

    setStatus(null);
    const problem = validateTripName(name);
    if (problem) {
      setError(problem.message);
      nameRef.current?.focus();
      return;
    }

    setError(null);
    pendingRef.current = true;
    setPending(true);
    try {
      const trip = await createTrip(normalizeTripName(name));
      setName('');
      setStatus(TRIP_CREATED_MESSAGE);
      pendingRef.current = false;
      setPending(false);
      onCreated(trip);
    } catch (caught) {
      pendingRef.current = false;
      setPending(false);
      // A session-expired 401 is already redirecting to Log in, so no message is shown.
      if (caught instanceof ApiError && caught.sessionExpired) {
        return;
      }
      const fieldMessage =
        caught instanceof ApiError && caught.status === 400 && caught.field === 'name'
          ? nameErrorMessage(caught.message)
          : null;
      setError(fieldMessage ?? CREATE_FAILED_MESSAGE);
      nameRef.current?.focus();
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor={nameId}>Trip name</label>
        <input
          id={nameId}
          ref={nameRef}
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending}>
        Create trip
      </button>

      <p role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
