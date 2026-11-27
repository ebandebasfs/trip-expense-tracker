import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { ApiError, GENERIC_ERROR_MESSAGE, type Trip } from '../lib/api-client';
import {
  DELETE_CONFIRMATION_MESSAGE,
  DELETE_FAILED_MESSAGE,
  EMPTY_TRIPS_MESSAGE,
  LOADING_TRIPS_MESSAGE,
  TRIP_DELETED_MESSAGE,
  TRIP_NOT_FOUND_MESSAGE,
  TripList,
} from './trip-list';

const PARIS: Trip = { id: 'trip-2', name: 'Paris 2026', createdAt: '2026-11-25T12:00:00.000Z' };
const LISBON: Trip = { id: 'trip-1', name: 'Lisbon', createdAt: '2026-11-25T10:00:00.000Z' };

type DeleteTrip = (id: string) => Promise<void>;

/** Holds the list in state, the way the Trips page does, so a delete removes the row. */
function Harness({ initial, deleteTrip }: { initial: Trip[] | null; deleteTrip: DeleteTrip }) {
  const [trips, setTrips] = useState<Trip[] | null>(initial);
  return (
    <TripList
      trips={trips}
      deleteTrip={deleteTrip}
      onDeleted={(id) => setTrips((current) => current?.filter((trip) => trip.id !== id) ?? null)}
    />
  );
}

function renderList(trips: Trip[] | null, deleteTrip: DeleteTrip = jest.fn(() => Promise.resolve())) {
  render(<Harness initial={trips} deleteTrip={deleteTrip} />);
  return { deleteTrip };
}

function openDeleteFor(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Delete trip ${name}` }));
}

function panel() {
  return screen.getByRole('group', { name: DELETE_CONFIRMATION_MESSAGE });
}

describe('TripList', () => {
  it('F2.AC6 while the list is loading, shows the loading message and no rows', () => {
    renderList(null);

    expect(screen.getByText(LOADING_TRIPS_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('F2.AC7 with no trips, shows the empty-state message and no rows', () => {
    renderList([]);

    expect(screen.getByText(EMPTY_TRIPS_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('F2.AC6 each row links its name to the trip page and has a Delete control named with the trip name', () => {
    renderList([PARIS, LISBON]);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const link = within(rows[0]).getByRole('link', { name: 'Paris 2026' });
    expect(link.getAttribute('href')).toBe('/trips/trip-2');
    expect(within(rows[0]).getByRole('button', { name: 'Delete trip Paris 2026' })).toBeTruthy();
    expect(within(rows[1]).getByRole('button', { name: 'Delete trip Lisbon' })).toBeTruthy();
  });

  it('F2.AC6 keeps the order it is given, showing only the name in each row', () => {
    renderList([PARIS, LISBON]);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].textContent).toBe('Paris 2026 Delete');
    expect(rows[1].textContent).toBe('Lisbon Delete');
  });

  it('F2.AC8 Delete opens the panel with the sentence, Cancel first, then Delete trip, and the panel takes focus', () => {
    const { deleteTrip } = renderList([LISBON]);

    openDeleteFor('Lisbon');

    const group = panel();
    expect(group).toBeTruthy();
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Delete trip']);
    expect(document.activeElement).toBe(group);
    expect(deleteTrip).not.toHaveBeenCalled();
  });

  it('F2.AC8 Cancel closes the panel, sends no request and leaves the trip listed', () => {
    const { deleteTrip } = renderList([LISBON]);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: DELETE_CONFIRMATION_MESSAGE })).toBeNull();
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy();
    expect(screen.queryByText(TRIP_DELETED_MESSAGE)).toBeNull();
  });

  it('F2.AC8 Escape closes the panel, sends no request and returns focus to that row Delete control', () => {
    const { deleteTrip } = renderList([LISBON]);

    openDeleteFor('Lisbon');
    fireEvent.keyDown(panel(), { key: 'Escape' });

    expect(screen.queryByRole('group', { name: DELETE_CONFIRMATION_MESSAGE })).toBeNull();
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete trip Lisbon' }));
  });

  it('F2.AC9 confirmed delete sends the trip ID, removes the row and announces "Trip deleted."', async () => {
    const { deleteTrip } = renderList([PARIS, LISBON]);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Lisbon' })).toBeNull());
    expect(deleteTrip).toHaveBeenCalledWith('trip-1');
    expect(screen.getByRole('link', { name: 'Paris 2026' })).toBeTruthy();
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe(TRIP_DELETED_MESSAGE);
  });

  it('F2.AC9 after a delete with trips left, focus moves to the list heading', async () => {
    renderList([PARIS, LISBON]);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your trips' })));
  });

  it('F2.AC9 after the last trip is deleted, focus moves to the empty-state message', async () => {
    renderList([LISBON]);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText(EMPTY_TRIPS_MESSAGE)));
    expect(screen.getByRole('status').textContent).toBe(TRIP_DELETED_MESSAGE);
  });

  it('F2.AC9 a failed delete shows the message, keeps the row and does not announce a deletion', async () => {
    const deleteTrip = jest.fn((_id: string) => Promise.reject(new ApiError(GENERIC_ERROR_MESSAGE, 500, null)));
    renderList([LISBON], deleteTrip);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(DELETE_FAILED_MESSAGE));
    expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('F2.AC9 a 404 not_found on delete removes the row, shows "This trip could not be found." and not the failure message', async () => {
    const deleteTrip = jest.fn((_id: string) => Promise.reject(new ApiError('not_found', 404, null)));
    renderList([PARIS, LISBON], deleteTrip);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Lisbon' })).toBeNull());
    expect(deleteTrip).toHaveBeenCalledWith('trip-1');
    expect(screen.getByRole('link', { name: 'Paris 2026' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(TRIP_NOT_FOUND_MESSAGE);
    expect(screen.queryByText(DELETE_FAILED_MESSAGE)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your trips' })));
  });

  it('F2.AC9 a 404 not_found on the last trip removes it and moves focus to the empty-state message', async () => {
    const deleteTrip = jest.fn((_id: string) => Promise.reject(new ApiError('not_found', 404, null)));
    renderList([LISBON], deleteTrip);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText(EMPTY_TRIPS_MESSAGE)));
    expect(screen.queryByRole('link', { name: 'Lisbon' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(TRIP_NOT_FOUND_MESSAGE);
    expect(screen.queryByText(DELETE_FAILED_MESSAGE)).toBeNull();
  });

  it('F2.AC9 a session-expired 401 during delete shows no message and keeps the row', async () => {
    const deleteTrip = jest.fn((_id: string) => Promise.reject(new ApiError('', 401, null, true)));
    renderList([LISBON], deleteTrip);

    openDeleteFor('Lisbon');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(deleteTrip).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy();
  });
});
