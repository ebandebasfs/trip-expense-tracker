'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ApiError, type Trip } from '../lib/api-client';

export const LOADING_TRIPS_MESSAGE = 'Loading your trips…';
export const EMPTY_TRIPS_MESSAGE = 'You have no trips yet. Create one above to get started.';
export const DELETE_CONFIRMATION_MESSAGE =
  'This deletes the trip and all its people, expenses and payments. This cannot be undone.';
export const TRIP_DELETED_MESSAGE = 'Trip deleted.';
export const DELETE_FAILED_MESSAGE = 'Could not delete the trip. Try again.';
export const TRIP_NOT_FOUND_MESSAGE = 'This trip could not be found.';
/** The API error code for a missing trip, or one that belongs to another user (F2.AC11). */
const NOT_FOUND_CODE = 'not_found';

export interface TripListProps {
  /** The visitor's trips, newest first. Null while the list is loading. */
  trips: Trip[] | null;
  /** Rejects with an ApiError when the trip is not deleted. */
  deleteTrip: (id: string) => Promise<void>;
  /** Called once the trip is deleted, so the page drops it from its list. */
  onDeleted: (id: string) => void;
}

/**
 * Trip list on the Trips page (F2 spec, Trips). Each row links to the trip and has a Delete control.
 * Delete opens a confirmation panel on that row. Nothing is deleted until "Delete trip" is clicked.
 */
export function TripList({ trips, deleteTrip, onDeleted }: TripListProps) {
  const ids = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  // Guards against a second delete in the same tick, before a re-render.
  const pendingRef = useRef(false);
  // Set after a successful delete. The next list update moves focus to the heading or the empty state.
  const focusAfterDeleteRef = useRef(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // The panel takes focus when it opens.
  useEffect(() => {
    if (openId !== null) {
      panelRef.current?.focus();
    }
  }, [openId]);

  useEffect(() => {
    if (!focusAfterDeleteRef.current || trips === null) {
      return;
    }
    focusAfterDeleteRef.current = false;
    if (trips.length === 0) {
      emptyRef.current?.focus();
    } else {
      headingRef.current?.focus();
    }
  }, [trips]);

  function openPanel(id: string) {
    setOpenId(id);
    setError(null);
    setStatus(null);
  }

  /** Closes the panel with no request and returns focus to that row's Delete control. */
  function closePanel(id: string) {
    setOpenId(null);
    setError(null);
    triggerRefs.current.get(id)?.focus();
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>, id: string) {
    if (event.key === 'Escape' && pendingRef.current === false) {
      event.preventDefault();
      closePanel(id);
    }
  }

  /** Drops the row and announces the message. Focus then moves like a normal delete. */
  function removeRow(id: string, message: string) {
    setOpenId(null);
    setStatus(message);
    focusAfterDeleteRef.current = true;
    onDeleted(id);
  }

  async function confirmDelete(id: string) {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setError(null);
    setStatus(null);
    try {
      await deleteTrip(id);
    } catch (caught) {
      pendingRef.current = false;
      // A session-expired 401 is already redirecting to Log in, so no message is shown.
      if (caught instanceof ApiError && caught.sessionExpired) {
        return;
      }
      // A 404 not_found means the trip is already gone (for example, deleted in another tab). The row goes.
      if (caught instanceof ApiError && caught.status === 404 && caught.message === NOT_FOUND_CODE) {
        removeRow(id, TRIP_NOT_FOUND_MESSAGE);
        return;
      }
      setError(DELETE_FAILED_MESSAGE);
      return;
    }
    pendingRef.current = false;
    removeRow(id, TRIP_DELETED_MESSAGE);
  }

  return (
    <section>
      <h2 ref={headingRef} tabIndex={-1}>
        Your trips
      </h2>

      {trips === null ? (
        <p>{LOADING_TRIPS_MESSAGE}</p>
      ) : trips.length === 0 ? (
        <p ref={emptyRef} tabIndex={-1}>
          {EMPTY_TRIPS_MESSAGE}
        </p>
      ) : (
        <ul>
          {trips.map((trip) => {
            const isOpen = openId === trip.id;
            const panelId = `${ids}-panel-${trip.id}`;
            const messageId = `${ids}-message-${trip.id}`;
            return (
              <li key={trip.id}>
                <Link href={`/trips/${encodeURIComponent(trip.id)}`}>{trip.name}</Link>{' '}
                <button
                  type="button"
                  aria-label={`Delete trip ${trip.name}`}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? panelId : undefined}
                  ref={(element) => {
                    if (element) {
                      triggerRefs.current.set(trip.id, element);
                    } else {
                      triggerRefs.current.delete(trip.id);
                    }
                  }}
                  onClick={() => openPanel(trip.id)}
                >
                  Delete
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    ref={panelRef}
                    tabIndex={-1}
                    role="group"
                    aria-labelledby={messageId}
                    onKeyDown={(event) => handlePanelKeyDown(event, trip.id)}
                  >
                    <p id={messageId}>{DELETE_CONFIRMATION_MESSAGE}</p>
                    {error && <p role="alert">{error}</p>}
                    <button type="button" onClick={() => closePanel(trip.id)}>
                      Cancel
                    </button>{' '}
                    <button type="button" onClick={() => confirmDelete(trip.id)}>
                      Delete trip
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
